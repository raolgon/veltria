import { app, BrowserWindow, dialog, nativeTheme, shell, ipcMain } from 'electron'
import { resolve, join } from 'node:path'
import { launchService } from '../../../scripts/supervisor'
import { dataDirectory } from '../../../scripts/paths'
import { settingsSchema, eventSchema, type Locale } from '@veltria/contracts'
import { translate } from '@veltria/core'

let service: Awaited<ReturnType<typeof launchService>> | undefined
let mainWindow: BrowserWindow | undefined, quitting = false, themeStream: AbortController | undefined
let sessionCookie = '', confirmingClose = false
let desktopLocale: Locale = 'es'
const t = (message: string) => translate(message, desktopLocale)
async function run() {
  await app.whenReady()
  const root = app.isPackaged ? process.resourcesPath : resolve(__dirname, '../../..')
  const uiDir = join(root, app.isPackaged ? 'ui' : 'apps/ui/dist')
  const executable = join(root, app.isPackaged ? 'service' : 'build/service', process.platform === 'win32' ? 'veltria-service.exe' : 'veltria-service')
  service = await launchService({ executable, uiDir, dataDir: dataDirectory(), onExit: message => { if (!quitting) { dialog.showErrorBox(t('Servicio detenido'), t(message)); app.quit() } } })
  const origin = service.ready.origin
  mainWindow = new BrowserWindow({ width: 1380, height: 900, minWidth: 320, minHeight: 480, show: false, backgroundColor: '#171717', title: 'Kobocraft', icon: join(uiDir, 'kobocraft-dark.png'), autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, navigateOnDragDrop: false }
  })
  ipcMain.handle('veltria:choose-engine-directory', async event => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || new URL(event.senderFrame.url).origin !== origin) throw new Error('Solicitud de carpeta no autorizada.')
    const result = await dialog.showOpenDialog(mainWindow, { title: t('Elegir carpeta en este equipo'), properties: ['openDirectory', 'dontAddToRecent'] })
    return result.canceled ? null : result.filePaths[0] || null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only the reviewed model source and its license may open in the user's normal browser.
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' && parsed.hostname === 'huggingface.co' && (parsed.pathname.startsWith('/Comfy-Org/stable-diffusion-v1-5-archive') || parsed.pathname.startsWith('/spaces/CompVis/stable-diffusion-license') || parsed.pathname.startsWith('/Comfy-Org/MiniMax-H3') || parsed.pathname.startsWith('/MiniMaxAI/MiniMax-H3') || parsed.pathname === '/Lykon/DreamShaper' || parsed.pathname === '/Lykon/DreamShaper/blob/228d79cb20811466f5c5710aa91f05dabd0b8a14/README.md')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault() })
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  mainWindow.webContents.session.setPermissionCheckHandler(() => false)
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const target = new URL(item.getURL())
    const video = /^\/api\/v1\/video\/artifacts\/[a-f0-9-]+$/.test(target.pathname)
    const configuration = /^\/api\/v1\/catalog\/configurations\/[a-z0-9-]{1,100}$/.test(target.pathname)
    if (target.origin !== origin || !(configuration || video || /^\/api\/v1\/artifacts\/[a-f0-9-]+$/.test(target.pathname))) { event.preventDefault(); return }
    item.setSaveDialogOptions({ title: t(configuration ? 'Guardar configuración' : video ? 'Guardar video' : 'Guardar imagen'), defaultPath: join(app.getPath('downloads'), item.getFilename()), filters: [{ name: t(configuration ? 'Configuración JSON' : video ? 'Video MP4' : 'Imagen PNG'), extensions: [configuration ? 'json' : video ? 'mp4' : 'png'] }] })
  })
  const response = await fetch(`${origin}/api/v1/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: service.ready.nonce }) })
  if (!response.ok) throw new Error('No se pudo autorizar la ventana.')
  const cookie = response.headers.get('set-cookie')?.match(/veltria_session=([^;]+)/)?.[1]
  if (!cookie) throw new Error('El servicio no devolvió la sesión.')
  sessionCookie = cookie
  await mainWindow.webContents.session.cookies.set({ url: origin, name: 'veltria_session', value: cookie, path: '/api/v1', httpOnly: true, sameSite: 'strict', secure: false })
  const applyPreferences = async () => {
    const result = await fetch(`${origin}/api/v1/settings`, { headers: { cookie: `veltria_session=${cookie}` } })
    if (result.ok) {
      const settings = settingsSchema.parse(await result.json()); nativeTheme.themeSource = settings.theme; desktopLocale = settings.locale
      try { mainWindow?.setIcon(join(uiDir, nativeTheme.shouldUseDarkColors ? 'kobocraft-dark.png' : 'kobocraft-light.png')) } catch {}
    }
  }
  await applyPreferences()
  // Node main only mirrors native chrome appearance; all product settings stay in Bun.
  themeStream = new AbortController()
  void (async () => {
    const stream = await fetch(`${origin}/api/v1/events`, { headers: { cookie: `veltria_session=${cookie}` }, signal: themeStream!.signal })
    let buffer = ''
    for await (const chunk of stream.body as any) {
      buffer += Buffer.from(chunk).toString('utf8')
      const frames = buffer.split('\n\n'); buffer = frames.pop() || ''
      for (const frame of frames) {
        const data = frame.split('\n').find(line => line.startsWith('data: '))
        if (data && eventSchema.parse(JSON.parse(data.slice(6))).kind === 'settings') await applyPreferences()
      }
    }
  })().catch(() => {})
  await mainWindow.loadURL(origin)
  mainWindow.on('close', event => {
    if (quitting || !service?.owned) return
    event.preventDefault()
    if (confirmingClose) return
    confirmingClose = true
    void (async () => {
      const activity = await fetch(`${origin}/api/v1/activity`, { headers: { cookie: `veltria_session=${sessionCookie}` }, signal: AbortSignal.timeout(2000) }).then(r => r.json()).catch(() => null) as any
      if (activity?.preparing || activity?.jobs) {
        const decision = await dialog.showMessageBox(mainWindow!, { type: 'question', title: t('Hay trabajo en curso'), message: t('Hay una preparación o creación en curso.'), detail: t('Si cierras, se conservarán los archivos descargados y las descripciones. Una generación interrumpida no se repetirá automáticamente.'), buttons: [t('Seguir en Kobocraft'), t('Cerrar y conservar progreso')], defaultId: 0, cancelId: 0 })
        if (decision.response === 0) { confirmingClose = false; return }
      }
      quitting = true; themeStream?.abort(); await service?.stop(); mainWindow?.destroy(); app.quit()
    })()
  })
  mainWindow.show()
  app.on('activate', () => mainWindow?.show())
}
app.on('window-all-closed', () => app.quit())
app.on('before-quit', event => {
  if (quitting) return
  event.preventDefault(); quitting = true; themeStream?.abort()
  void service?.stop().finally(() => app.quit())
  if (!service) app.quit()
})
run().catch(error => { dialog.showErrorBox(t('Kobocraft no pudo abrirse'), t(error instanceof Error ? error.message : 'Error de inicio')); app.quit() })
