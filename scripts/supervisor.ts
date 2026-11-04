import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { readySchema, protocol, development } from '@veltria/contracts'
import { z } from 'zod'
const descriptorSchema = z.object({ pid: z.number().int().positive(), name: z.literal('veltria'), protocol: z.literal(protocol), instanceId: z.string(), origin: z.string(), controlToken: z.string().length(64) })
type LaunchOptions = { executable: string; args?: string[]; uiDir: string; dataDir: string; dev?: boolean; onExit?: (message: string) => void }
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
function verifyOrigin(origin: string) {
  const url = new URL(origin)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.origin !== origin) throw new Error('El auxiliar devolvió un origen no autorizado.')
}
export async function launchService(options: LaunchOptions) {
  const lockDir = join(options.dataDir, '.service-lock'), file = join(lockDir, 'instance.json')
  async function attach() {
    let contents: string
    try { contents = await readFile(file, 'utf8') }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e }
    const raw = JSON.parse(contents)
    if (raw?.platform && raw.platform !== process.platform) throw new Error('Este directorio de datos pertenece a un servicio de otro sistema operativo. Windows y WSL deben usar directorios separados.')
    if (raw?.name === 'veltria' && raw.protocol !== protocol) throw new Error('Hay otra versión de Veltria abierta. Ciérrala y vuelve a abrir la versión actual para conservar y migrar sus datos.')
    const descriptor = descriptorSchema.parse(raw)
    try { process.kill(descriptor.pid, 0) }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e
      if (await readFile(file, 'utf8') === contents) await rm(lockDir, { recursive: true })
      return null
    }
    if (!descriptor.origin) throw new Error('Otro servicio está iniciando; vuelve a abrir Veltria en unos segundos.')
    verifyOrigin(descriptor.origin)
    const response = await fetch(`${descriptor.origin}/api/v1/control/launch`, { method: 'POST', headers: { 'x-veltria-control': descriptor.controlToken }, signal: AbortSignal.timeout(3000), redirect: 'error' })
    if (!response.ok) throw new Error('La instancia existente no autorizó el lanzamiento.')
    const ready = readySchema.parse(await response.json())
    if (ready.origin !== descriptor.origin || ready.instanceId !== descriptor.instanceId) throw new Error('Identidad del servicio existente no válida.')
    return { ready, owned: false, child: null, async stop() {} }
  }
  const existing = await attach()
  if (existing) return existing
  const controlToken = randomBytes(32).toString('hex')
  const child: ChildProcessWithoutNullStreams = spawn(options.executable, [...(options.args || []), '--ui-dir', options.uiDir, '--data-dir', options.dataDir, ...(options.dev ? ['--port', new URL(development.serviceOrigin).port, '--dev-origin', development.uiOrigin] : [])], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  let stopping = false, exited = false
  child.once('exit', () => { exited = true; if (!stopping) options.onExit?.('El servicio local se detuvo. Cierra y vuelve a abrir Veltria; los ajustes guardados se conservan.') })
  // Service only writes bounded status/errors; never relay its private readiness line to logs.
  child.stderr.on('data', chunk => process.stderr.write(String(chunk).slice(0, 4096)))
  child.stdin.on('error', () => {}) // launch failures are reported by the child error/exit handlers below
  child.stdin.end(JSON.stringify({ controlToken }))
  let ready: z.infer<typeof readySchema>
  try {
    ready = await new Promise((resolve, reject) => {
      let buffer = ''
      const timer = setTimeout(() => reject(new Error('El servicio no inició en 15 segundos.')), 15_000)
      const fail = (error: Error) => { clearTimeout(timer); reject(error) }
      child.once('error', fail)
      child.once('exit', code => fail(new Error(`El auxiliar terminó durante el inicio (${code}).`)))
      child.stdout.on('data', chunk => {
        buffer += chunk.toString()
        if (buffer.length > 4096) return fail(new Error('Respuesta de arranque demasiado grande.'))
        if (buffer.includes('\n')) {
          clearTimeout(timer)
          try { resolve(readySchema.parse(JSON.parse(buffer.split('\n')[0]))) } catch { reject(new Error('Respuesta de arranque no válida.')) }
        }
      })
    })
    verifyOrigin(ready.origin)
    // Prove control ownership before handing an origin to the renderer.
    const proof = await fetch(`${ready.origin}/api/v1/control/launch`, { method: 'POST', headers: { 'x-veltria-control': controlToken }, signal: AbortSignal.timeout(3000), redirect: 'error' })
    const verified = readySchema.parse(await proof.json())
    if (verified.instanceId !== ready.instanceId || verified.origin !== ready.origin) throw new Error('No se pudo verificar la identidad del auxiliar.')
  } catch (error) {
    stopping = true; child.kill()
    // A concurrent launcher may have won the exclusive data lock.
    const attached = await attach().catch(() => null)
    if (attached) return attached
    throw error
  }
  return { ready, owned: true, child,
    async stop() {
      if (stopping || exited) return
      stopping = true
      await fetch(`${ready.origin}/api/v1/control/shutdown`, { method: 'POST', headers: { 'x-veltria-control': controlToken }, signal: AbortSignal.timeout(1500) }).catch(() => {})
      for (let i = 0; i < 120 && !exited; i++) await delay(100)
      if (!exited) child.kill() // only this supervisor's exact child; no process-name killing
    }
  }
}
