import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { launchService } from '../scripts/supervisor'

let directory: string, service: Awaited<ReturnType<typeof launchService>>
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'Veltria UI smoke '))
  service = await launchService({ executable: resolve('build/service', process.platform === 'win32' ? 'veltria-service.exe' : 'veltria-service'), uiDir: resolve('apps/ui/dist'), dataDir: directory })
})
test.afterAll(async () => { await service?.stop(); if (directory) await rm(directory, { recursive: true, force: true }) })
async function launchUrl() {
  const attached = await launchService({ executable: '', uiDir: resolve('apps/ui/dist'), dataDir: directory })
  return `${attached.ready.origin}/#launch=${attached.ready.nonce}`
}
test('navegador: estados reales, persistencia y Obsidian responsive', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(await launchUrl())
  await expect(page.getByText('Servicio local conectado')).toBeVisible()
  await expect(page).not.toHaveURL(/launch=/)
  expect((await context.cookies()).find(c => c.name === 'veltria_session')?.httpOnly).toBe(true)
  await page.getByLabel('Describe lo que imaginas').fill('Mi idea permanece: 日本語 y acentos.')
  for (const theme of ['Claro', 'Oscuro']) {
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1363, 900], [740, 360]]) {
      await page.setViewportSize({ width, height })
      const nav = width <= 740 ? page.locator('.mobile-nav') : page.locator('.sidebar nav')
      await page.getByLabel('Describe lo que imaginas').blur()
      await nav.getByRole('button', { name: 'Ajustes' }).click()
      await page.getByRole('button', { name: theme, exact: true }).click()
      const expectedLogo = theme === 'Claro' ? '/kobocraft-light.svg' : '/kobocraft-dark.svg'
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'Claro' ? 'light' : 'dark')
      await expect(page.locator(width <= 740 ? '.mobile-brand .brand-logo' : '.brand .brand-logo')).toHaveAttribute('src', expectedLogo)
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', expectedLogo)
      await expect(page.getByText('Apariencia guardada en este equipo.')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await nav.getByRole('button', { name: 'Mi equipo' }).click()
      await expect(page.getByRole('heading', { name: 'Mi equipo', exact: true })).toBeVisible()
      await expect(page.locator('.hardware-list')).toContainText('Procesador')
      await page.getByText('Avanzado · Usar una instalación existente de ComfyUI', { exact: true }).click()
      await expect(page.getByLabel('Dirección local de ComfyUI')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width === 320) await page.screenshot({ path: `test-results/device-${theme}-320.png`, fullPage: true })
      await nav.getByRole('button', { name: 'Crear', exact: true }).click()
      await expect(page.getByLabel('Describe lo que imaginas')).toHaveValue('Mi idea permanece: 日本語 y acentos.')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width === 320 || width === 1363) await page.screenshot({ path: `test-results/create-${theme}-${width}.png`, fullPage: true })
    }
  }
  await page.setViewportSize({ width: 1363, height: 900 })
  await page.reload()
  await expect(page.getByText('Servicio local conectado')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByLabel('Describe lo que imaginas')).toHaveValue('Mi idea permanece: 日本語 y acentos.')
  await page.locator('.sidebar nav').getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'Sistema', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(errors).toEqual([])
})

test('Electron: mismo servicio y preferencia que el navegador, contenedor aislado', async ({ page }) => {
  test.skip(!!process.env.VELTRIA_SKIP_ELECTRON, 'Host sin soporte de ventana Electron; queda pendiente.')
  await page.goto(await launchUrl()); await expect(page.getByText('Servicio local conectado')).toBeVisible()
  await page.locator('.sidebar nav').getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'Claro', exact: true }).click()
  await expect(page.getByText('Apariencia guardada en este equipo.')).toBeVisible()
  const packaged = process.env.VELTRIA_ELECTRON_EXECUTABLE
  const app = await electron.launch({ chromiumSandbox: true, ...(packaged ? { executablePath: packaged } : {}), args: packaged ? [] : [resolve('apps/desktop/dist/main.cjs')], env: { ...process.env, VELTRIA_DATA_DIR: directory } })
  try {
    const window = await app.firstWindow()
    await expect(window.getByText('Servicio local conectado')).toBeVisible()
    await expect(window.getByRole('region', { name: 'Recursos del equipo' })).toContainText('En vivo')
    await expect(window.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await window.evaluate(() => (window as any).veltriaDesktop)).toMatchObject({ sandboxed: true, contextIsolated: true })
    expect(await window.evaluate(() => typeof (window as any).require)).toBe('undefined')
    await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
    await expect(window.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark')
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(window.locator('html')).toHaveAttribute('lang', 'en')
    await expect(window.getByRole('region', { name: 'Computer resources' })).toContainText('Live')
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      let title = ''
      const item = { getURL: () => new URL('/api/v1/artifacts/00000000-0000-4000-8000-000000000000?download=1', window.webContents.getURL()).href, getFilename: () => 'test.png', setSaveDialogOptions: (options: { title: string }) => { title = options.title } }
      // Inspect the real download handler's options without opening a native dialog or saving a file.
      ;(window.webContents.session as any).emit('will-download', { preventDefault() {} }, item)
      return title
    })).toBe('Save image')
    await window.screenshot({ path: 'test-results/electron-english.png' })
    await page.getByRole('button', { name: 'Español', exact: true }).click()
    await expect(window.locator('html')).toHaveAttribute('lang', 'es')
    await window.screenshot({ path: 'test-results/electron-dark.png' })
  } finally { await app.close() }
  expect((await fetch(`${service.ready.origin}/api/v1/identity`)).status).toBe(200)
})

test('Electron propietario: arranca y cierra su auxiliar con rutas de datos con espacios', async () => {
  test.skip(!!process.env.VELTRIA_SKIP_ELECTRON, 'Host sin soporte de ventana Electron; queda pendiente.')
  const ownData = join(directory, 'Desktop owned data with spaces')
  const packaged = process.env.VELTRIA_ELECTRON_EXECUTABLE
  const app = await electron.launch({ chromiumSandbox: true, ...(packaged ? { executablePath: packaged } : {}), args: packaged ? [] : [resolve('apps/desktop/dist/main.cjs')], env: { ...process.env, VELTRIA_DATA_DIR: ownData } })
  const window = await app.firstWindow()
  await expect(window.getByText('Servicio local conectado')).toBeVisible()
  await app.close()
  await expect.poll(async () => { try { await access(join(ownData, '.service-lock')); return true } catch { return false } }).toBe(false)
  await access(join(ownData, 'settings.sqlite'))
})

test('sin sesión: error útil y tema temporal, sin inventar hardware', async ({ page }) => {
  await page.goto(service.ready.origin)
  await expect(page.getByRole('alert')).toContainText('Sesión ausente')
  await page.locator('.sidebar nav').getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'Claro', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Apariencia temporal')
})

test('recursos laterales: actualización, fallo, recuperación y pausa al ocultar', async ({ page }) => {
  let calls = 0
  await page.route('**/api/v1/resources', async route => {
    calls++
    if (calls === 3) { await route.fulfill({ status: 503, json: { message: 'Fixture: sensor no disponible' } }); return }
    const memory = { total: 16 * 1024 ** 3, used: (calls === 1 ? 4 : 8) * 1024 ** 3, available: (calls === 1 ? 12 : 8) * 1024 ** 3 }
    await route.fulfill({ json: {
      sampledAt: new Date().toISOString(), platform: 'win32', wsl: false,
      cpu: { percent: calls === 1 ? 12 : 68 }, ram: memory,
      gpus: [{ name: 'GPU de fixture; sin inferencia', percent: calls >= 4 ? null : 43, memory: { total: 6 * 1024 ** 3, used: 2 * 1024 ** 3, available: 4 * 1024 ** 3 } }],
      disk: { total: 100 * 1024 ** 3, used: 40 * 1024 ** 3, available: 60 * 1024 ** 3, path: 'C:\\fixture' }
    } })
  })
  await page.setViewportSize({ width: 1363, height: 900 }); await page.goto(await launchUrl())
  const monitor = page.getByRole('region', { name: 'Recursos del equipo' })
  const cpu = monitor.locator('.resource-row').filter({ hasText: 'CPU' })
  await expect(cpu.locator('.resource-value')).toHaveText('12 %')
  await expect(cpu.locator('.resource-component-name')).toBeVisible()
  await expect(monitor.locator('.resource-component-name')).toHaveCount(2)
  await expect(monitor.locator('.resource-component-name').last()).toHaveText('GPU de fixture; sin inferencia')
  await expect(monitor).toContainText('4 GiB / 16 GiB')
  await expect(monitor).toContainText('60 GiB libres')
  await expect(cpu.locator('.resource-value')).toHaveText('68 %', { timeout: 7000 })
  await expect(monitor).toContainText('8 GiB / 16 GiB')
  await page.screenshot({ path: 'test-results/resources-desktop-fixture.png', fullPage: true })
  await expect(monitor).toContainText('Lectura no disponible', { timeout: 7000 })
  await expect(monitor.getByRole('meter')).toHaveCount(0)
  await expect(monitor).toContainText('En vivo', { timeout: 7000 })
  await expect(monitor.locator('.resource-row').filter({ hasText: 'GPU' }).locator('.resource-value')).toHaveText('—')
  await page.setViewportSize({ width: 1100, height: 780 })
  expect(await monitor.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(cpu.locator('.resource-compact-value')).toHaveText('68 %')
  expect(await monitor.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/resources-tablet-fixture.png', fullPage: true })
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  const before = calls
  await page.waitForTimeout(3500)
  expect(calls).toBe(before)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect.poll(() => calls).toBeGreaterThan(before)
})

test('idioma: cambio inmediato, dos ventanas, reapertura, contenido propio y móvil', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(await launchUrl())
  const draft = 'Crear imagen — mi descripción 日本語'
  await page.getByLabel('Describe lo que imaginas').fill(draft)
  const peer = await context.newPage()
  await peer.goto(service.ready.origin)
  await expect(peer.getByText('Servicio local conectado')).toBeVisible()
  await page.locator('.sidebar nav').getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Language saved on this computer.')
  await expect(peer.locator('html')).toHaveAttribute('lang', 'en')
  await expect(peer.getByRole('heading', { name: 'What will you imagine today?' })).toBeVisible()
  await expect(page.locator('.side-note')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByLabel('Describe what you imagine')).toHaveValue(draft)
  await page.getByText('Model and profile limitations', { exact: true }).click()
  await expect(page.getByText('Classic 2022 model: lower quality and understanding than recent models.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Computer resources' })).toContainText('Live')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/english-create-desktop.png' })
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1363, 900]]) {
    await page.setViewportSize({ width, height })
    const nav = width <= 740 ? page.locator('.mobile-nav') : page.locator('.sidebar nav')
    await nav.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: width === 390 ? 'Dark' : 'Light', exact: true }).click()
    await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 320) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: 'test-results/english-settings-mobile.png' }) }
    await nav.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByLabel('Describe what you imagine')).toHaveValue(draft)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width === 320) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: 'test-results/english-create-mobile.png' }) }
  }
  await page.locator('.sidebar nav').getByRole('button', { name: 'My computer', exact: true }).click()
  await page.getByText('Advanced · Use an existing ComfyUI installation', { exact: true }).click()
  await page.getByLabel('Local ComfyUI address').fill('http://192.168.1.2:8188')
  await page.getByRole('button', { name: 'Save address', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid input. Check the values and try again.')
  await page.locator('.sidebar nav').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Español', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(peer.locator('html')).toHaveAttribute('lang', 'es')
  await page.locator('.sidebar nav').getByRole('button', { name: 'Crear', exact: true }).click()
  await expect(page.getByLabel('Describe lo que imaginas')).toHaveValue(draft)
  await peer.close()
  expect(errors).toEqual([])
})

test('catálogo real: tres modelos, configuraciones, plan y navegación en escritorio y móvil', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(await launchUrl())
  await expect(page.getByText('Servicio local conectado')).toBeVisible()
  for (const [width, height, theme, locale] of [[1363, 900, 'dark', 'es'], [320, 568, 'light', 'es'], [320, 568, 'dark', 'en'], [1363, 900, 'light', 'en']] as const) {
    await page.evaluate(async ({ theme, locale }) => {
      const session = await fetch('/api/v1/session').then(response => response.json())
      await fetch('/api/v1/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-veltria-csrf': session.csrf }, body: JSON.stringify({ theme, locale }) })
    }, { theme, locale })
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await page.setViewportSize({ width, height })
    const nav = width <= 740 ? page.locator('.mobile-nav') : page.locator('.sidebar nav')
    await nav.getByRole('button', { name: locale === 'en' ? 'Models' : 'Modelos', exact: true }).click()
    await page.getByRole('button', { name: locale === 'en' ? 'Explore all' : 'Explorar todo', exact: true }).click()
    await expect(page.locator('.model-row')).toHaveCount(3)
    await expect(page.locator('.model-row').last()).toContainText('Stable Diffusion XL')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/catalog-${locale}-${theme}-${width}.png`, fullPage: true })
  }
  await page.locator('.model-row').filter({hasText:'DreamShaper 8'}).getByRole('button', { name: 'Review download', exact: true }).click()
  const plan = page.getByRole('dialog')
  await expect(plan).toBeVisible()
  await expect(plan.getByRole('heading', { name: 'Prepare my computer', exact: true })).toBeVisible()
  await expect(page.locator('.profile-card')).toContainText('DreamShaper 8')
  await expect(plan.getByText('Looking for existing tools on your computer…', { exact: true })).not.toBeVisible({ timeout: 25000 })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.locator('.sidebar nav').getByRole('button', { name: 'Models', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('descubrimiento: intención, filtros, resultados externos y fallo recuperable sin perder el catálogo', async ({ page }) => {
  await page.goto(await launchUrl())
  await expect(page.getByText(/Servicio local conectado|Local service connected/)).toBeVisible()
  await page.evaluate(async () => { const session = await fetch('/api/v1/session').then(r => r.json()); await fetch('/api/v1/settings', {method:'PATCH', headers:{'content-type':'application/json','x-veltria-csrf':session.csrf},body:JSON.stringify({locale:'es'})}) })
  await page.locator('.sidebar nav').getByRole('button', {name:'Modelos', exact:true}).click()
  await page.getByRole('button', {name:'Explorar todo',exact:true}).click()
  await page.getByRole('button', {name:'Ilustración',exact:true}).click()
  await expect(page.locator('.model-row')).toHaveCount(1)
  await expect(page.locator('.model-row')).toContainText('DreamShaper')
  await page.locator('#model-search').fill('sin coincidencias')
  await expect(page.getByText('No hay coincidencias en tu catálogo. Prueba otra búsqueda o explora todo.',{exact:true})).toBeVisible()
  await page.route('**/api/v1/catalog/search', route => route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({partial:false,results:[{repository:'fixture/Illustration', revision:'a'.repeat(40),kind:'lora',family:'SD 1.5',supported:true,files:[{name:'style.safetensors',bytes:1024}],reason:'Familia declarada compatible; ejecución sin comprobar.',source:'https://huggingface.co/fixture/Illustration'}]})}))
  await page.getByRole('button',{name:'Buscar en Internet',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Illustration',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Preparar y usar',exact:true})).toBeVisible()
  await page.locator('.discovery-results summary').click()
  await expect(page.getByLabel('Intensidad de la adaptación')).toHaveValue('0.7')
  for (const [width,height] of [[1363,900],[320,568]]) { await page.setViewportSize({width,height}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({path:`test-results/discovery-${width}.png`,fullPage:true}) }
  await page.route('**/api/v1/catalog/search', route => route.fulfill({status:502, contentType:'application/json',body:JSON.stringify({message:'Proveedor no disponible. Vuelve a buscar.'})}))
  await page.getByRole('button',{name:'Buscar en Internet',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Proveedor no disponible')
  await page.locator('#model-search').fill('')
  await expect(page.locator('.model-row')).toHaveCount(3)
})

test('explorar compatibles sin texto: popularidad, más páginas y conservación ante fallos', async ({page}) => {
  await page.route('**/api/v1/creation', async route => {const response=await route.fetch();const state=await response.json();state.recommendation.level='recommended';await route.fulfill({response,json:state})})
  await page.goto(await launchUrl())
  await page.evaluate(async()=>{const s=await fetch('/api/v1/session').then(r=>r.json());await fetch('/api/v1/settings',{method:'PATCH',headers:{'content-type':'application/json','x-veltria-csrf':s.csrf},body:JSON.stringify({locale:'es'})})})
  await page.locator('.sidebar nav').getByRole('button',{name:'Modelos',exact:true}).click()
  const entry=(name:string,downloads:number)=>({repository:'fixture/'+name,revision:'a'.repeat(40),kind:'model',family:'SD 1.5',supported:true,files:[{name:'full.safetensors',bytes:1024}],reason:'Familia declarada compatible; ejecución sin comprobar.',source:'https://huggingface.co/fixture/'+name,downloads})
  let calls=0
  await page.route('**/api/v1/catalog/browse',async route=>{
    const body=route.request().postDataJSON();expect(body).not.toHaveProperty('query');calls++
    if(calls===1)await route.fulfill({json:{results:[entry('Less',10),entry('Popular',200)],partial:false,nextCursor:'second'}})
    else if(calls===2){expect(body.cursor).toBe('second');await route.fulfill({json:{results:[entry('Less',10),entry('Next',5)],partial:false,nextCursor:'third'}})}
    else await route.fulfill({status:502,json:{message:'No se pudo consultar el proveedor.'}})
  })
  await page.locator('#model-search').fill('idea anterior')
  await page.getByRole('button',{name:'Ver modelos para mi equipo',exact:true}).click()
  await expect(page.locator('#model-search')).toHaveValue('')
  await expect(page.locator('.discovery-results h3').first()).toHaveText('Popular')
  await expect(page.locator('.discovery-results')).toContainText('200 descargas')
  await page.getByRole('button',{name:'Ver más modelos',exact:true}).click()
  await expect(page.locator('.discovery-results h3')).toHaveText(['Popular','Less','Next'])
  for(const [width,height] of [[1363,900],[320,568]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/compatible-browse-${width}.png`,fullPage:true})}
  await page.getByRole('button',{name:'Ver más modelos',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar')
  await expect(page.locator('.discovery-results h3')).toHaveCount(3)
})

test('recomendaciones: reutilizar primero, popularidad opcional y ajustes visibles',async({page})=>{
  await page.route('**/api/v1/catalog',async route=>{
    const response=await route.fetch(), catalog=await response.json()
    for(const model of catalog.models){model.recommendation.level='recommended';model.recommendation.verified=false;model.status='missing'}
    catalog.models[1].status='prepared'
    await route.fulfill({response,json:catalog})
  })
  await page.goto(await launchUrl())
  await page.evaluate(async()=>{const s=await fetch('/api/v1/session').then(r=>r.json());await fetch('/api/v1/settings',{method:'PATCH',headers:{'content-type':'application/json','x-veltria-csrf':s.csrf},body:JSON.stringify({locale:'es'})})})
  await page.locator('.sidebar nav').getByRole('button',{name:'Modelos',exact:true}).click()
  await expect(page.locator('.catalog-guidance')).toContainText('DreamShaper')
  await expect(page.locator('.model-row').first()).toContainText('DreamShaper')
  await expect(page.locator('.starting-settings').first()).toContainText('512 × 512')
  await page.locator('#catalog-order').selectOption('popular')
  await expect(page.locator('.catalog-guidance')).toHaveCount(0)
  await expect(page.locator('.model-row').first()).toContainText('Stable Diffusion')
  await page.locator('#catalog-order').selectOption('recommended')
  for(const [width,height] of [[1363,900],[320,568]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/guidance-${width}.png`,fullPage:true})}
})
