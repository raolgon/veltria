import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { createWriteStream } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, isAbsolute, dirname, resolve } from 'node:path'
import net from 'node:net'
import { bindingSchema, type Settings } from '@veltria/contracts'
import { recipeNodes } from '@veltria/core'
const execute = promisify(execFile)
const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
  const abort = () => { clearTimeout(timer); reject(new DOMException('Operación detenida', 'AbortError')) }
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true })
})
export async function validateEngineBinding(value: unknown): Promise<NonNullable<Settings['engineBinding']>> {
  const binding = bindingSchema.parse(value)
  if (!isAbsolute(binding.directory) || !isAbsolute(binding.python)) throw new Error('Selecciona rutas absolutas del motor y de su Python existente.')
  for (const name of ['main.py', 'comfy/cli_args.py', 'folder_paths.py']) await access(join(binding.directory, name)).catch(() => { throw new Error('La carpeta seleccionada no contiene una instalación de ComfyUI compatible.') })
  await access(binding.python).catch(() => { throw new Error('No se encontró el Python de esa instalación. No se instalará otro entorno.') })
  const expected = process.platform === 'win32' ? '.exe' : ''
  if (!/^(python|python3|python3\.\d+)(\.exe)?$/i.test(binding.python.split(/[\\/]/).pop() || '') || expected && !binding.python.toLowerCase().endsWith(expected)) throw new Error('Selecciona el ejecutable Python existente de la instalación.')
  const args = await readFile(join(binding.directory, 'comfy/cli_args.py'), 'utf8')
  for (const flag of ['--extra-model-paths-config', '--user-directory', '--disable-all-custom-nodes', '--database-url']) if (!args.includes(flag)) throw new Error(`Este ComfyUI no admite ${flag}. No se modificará su instalación.`)
  return { directory: resolve(binding.directory), python: resolve(binding.python) }
}
async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = (server.address() as net.AddressInfo).port
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}
export async function engineJson(origin: string, path: string, body?: unknown, signal?: AbortSignal): Promise<any> {
  const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000), redirect: 'error' })
  const length = Number(response.headers.get('content-length') || 0)
  if (length > 12 * 1024 * 1024) { await response.body?.cancel(); throw new Error('Respuesta del motor demasiado grande.') }
  const reader = response.body?.getReader(); let size = 0; const chunks: Uint8Array[] = []
  if (reader) try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 12 * 1024 * 1024) throw new Error('Respuesta del motor demasiado grande.'); chunks.push(value) } } finally { await reader.cancel().catch(() => {}) }
  let json: any = {}
  try { json = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { throw new Error('El motor devolvió una respuesta no válida.') }
  if (!response.ok) throw new Error(response.status === 400 ? 'El motor rechazó la receta o alguno de sus componentes. Revisa los detalles del perfil.' : `El motor respondió HTTP ${response.status}.`)
  return json
}
export interface ImageEngine {
  readonly origin: string | null
  readonly version: string | null
  start(binding: NonNullable<Settings['engineBinding']>, modelsDirectory: string, checkpoint: string, signal: AbortSignal, memoryMode?: 'lowvram'): Promise<void>
  stop(): Promise<void>
}
type EngineOptions = { folder?: string; requiredNodes?: readonly string[]; validateNodes?: (nodes: any) => void }
export class LocalImageEngine implements ImageEngine {
  origin: string | null = null
  version: string | null = null
  private child: ChildProcess | null = null
  private starting: Promise<void> | null = null
  constructor(private dataDir: string, private options: EngineOptions = {}) {}
  async start(binding: NonNullable<Settings['engineBinding']>, modelsDirectory: string, checkpoint: string, signal: AbortSignal, memoryMode?: 'lowvram') {
    if (this.origin) {
      try { await engineJson(this.origin, '/system_stats', undefined, signal); return } catch { await this.stop() }
    }
    if (this.starting) return this.starting
    this.starting = this.launch(binding, modelsDirectory, checkpoint, signal, memoryMode).finally(() => { this.starting = null })
    return this.starting
  }
  private async launch(value: NonNullable<Settings['engineBinding']>, modelsDirectory: string, checkpoint: string, signal: AbortSignal, memoryMode?: 'lowvram') {
    const binding = await validateEngineBinding(value)
    const runtime = join(this.dataDir, this.options.folder || 'image-engine')
    for (const folder of ['user', 'input', 'output', 'temp']) await mkdir(join(runtime, folder), { recursive: true, mode: 0o700 })
    const config = join(runtime, 'model-paths.yaml')
    await writeFile(config, `veltria:\n  base_path: ${JSON.stringify(modelsDirectory)}\n  checkpoints: checkpoints\n  loras: loras\n`, { mode: 0o600 })
    // Own wrapper only: never patch ComfyUI. Exit the exact interpreter if its Bun owner crashes.
    const bootstrap = join(runtime, 'bootstrap.py')
    await writeFile(bootstrap, `import os, sys, threading, time, runpy\nowner = int(sys.argv[1])\nentry = sys.argv[2]\nsys.argv = sys.argv[2:]\nsys.path.insert(0, os.path.dirname(entry))\ndef watch_owner():\n    if os.name == 'nt':\n        import ctypes\n        kernel = ctypes.WinDLL('kernel32', use_last_error=True)\n        kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]\n        kernel.OpenProcess.restype = ctypes.c_void_p\n        kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]\n        kernel.CloseHandle.argtypes = [ctypes.c_void_p]\n        handle = kernel.OpenProcess(0x00100000, 0, owner)\n        if not handle:\n            os._exit(0)\n        kernel.WaitForSingleObject(handle, 0xffffffff)\n        kernel.CloseHandle(handle)\n        os._exit(0)\n    else:\n        while True:\n            if os.getppid() != owner:\n                os._exit(0)\n            time.sleep(1)\nthreading.Thread(target=watch_owner, daemon=True).start()\nrunpy.run_path(entry, run_name='__main__')\n`, { mode: 0o600 })
    const env: NodeJS.ProcessEnv = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' }
    if (process.platform === 'win32') {
      // venv launchers need their already-installed base DLLs; read only the selected venv's declaration.
      const cfg = await readFile(join(dirname(dirname(binding.python)), 'pyvenv.cfg'), 'utf8').catch(() => '')
      const home = /^home\s*=\s*(.+)$/m.exec(cfg)?.[1]?.trim()
      if (home && isAbsolute(home)) env.PATH = [home, join(home, 'Library', 'bin'), join(home, 'DLLs'), dirname(binding.python), process.env.PATH].filter(Boolean).join(';')
    }
    const port = await freePort(), origin = `http://127.0.0.1:${port}`
    const child = spawn(binding.python, ['-B', bootstrap, String(process.pid), join(binding.directory, 'main.py'), '--listen', '127.0.0.1', '--port', String(port), '--disable-auto-launch', ...(memoryMode==='lowvram'?['--lowvram']:[]), '--disable-all-custom-nodes', '--extra-model-paths-config', config, '--user-directory', join(runtime, 'user'), '--input-directory', join(runtime, 'input'), '--output-directory', join(runtime, 'output'), '--temp-directory', join(runtime, 'temp'), '--database-url', 'sqlite:///:memory:'], { cwd: binding.directory, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
    this.child = child
    const log = createWriteStream(join(runtime, 'engine.log'), { flags: 'a', mode: 0o600 })
    child.stdout?.on('data', data => log.write(data)); child.stderr?.on('data', data => log.write(data))
    let spawnError: Error | undefined
    child.once('error', error => { spawnError = error })
    child.once('exit', () => { log.end(); if (this.child === child) { this.origin = null; this.version = null } })
    try {
      const deadline = Date.now() + 180_000
      while (Date.now() < deadline) {
        signal.throwIfAborted()
        if (spawnError || child.exitCode !== null) throw new Error('El motor existente no pudo arrancar. Sus archivos se conservan; revisa image-engine/engine.log en los datos de Veltria.')
        try {
          const stats = await engineJson(origin, '/system_stats', undefined, signal)
          if (!stats.system || !Array.isArray(stats.devices)) throw new Error('Respuesta no válida')
          const nodes = await engineJson(origin, '/object_info', undefined, signal)
          for (const node of this.options.requiredNodes || recipeNodes) if (!nodes[node]) throw new Error(`Falta el nodo ${node} en este motor.`)
          const choices = nodes.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]
          if (checkpoint && (!Array.isArray(choices) || !choices.includes(checkpoint))) throw new Error('El motor no pudo reconocer el modelo preparado.')
          this.options.validateNodes?.(nodes)
          // Safe cancellation must address one exact job. Do not use the global /interrupt endpoint.
          const source = await readFile(join(binding.directory, 'server.py'), 'utf8')
          if (!source.includes('/api/jobs/{job_id}/cancel') || !source.includes('interrupt_if_running')) throw new Error('Este motor no ofrece la cancelación segura por trabajo requerida por Veltria.')
          this.origin = origin; this.version = typeof stats.system.comfyui_version === 'string' ? stats.system.comfyui_version : null
          return
        } catch (error) {
          if (error instanceof Error && /Falta el nodo|reconocer el modelo|cancelación segura|perfil de video/.test(error.message)) throw error
        }
        await delay(1000, signal)
      }
      throw new Error('El motor tardó más de tres minutos en abrir. Se conserva la descarga; vuelve a preparar para reintentar.')
    } catch (error) { await this.stop(); throw error }
  }
  async stop() {
    const child = this.child
    this.child = null; this.origin = null; this.version = null
    if (!child?.pid || child.exitCode !== null) return
    if (process.platform === 'win32') {
      // Python venv launchers create a child interpreter on Windows. Stop only our exact process tree.
      await execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }).catch(() => {})
    } else { try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') } }
    await Promise.race([new Promise<void>(resolve => child.once('exit', () => resolve())), delay(1500)])
    if (child.exitCode === null && process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGKILL') } catch {} }
  }
}
