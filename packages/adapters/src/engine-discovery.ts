import { stat, realpath, open, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, dirname, basename, resolve, isAbsolute } from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import type { Installation, Settings } from '@veltria/contracts'
import { validateEngineBinding } from './image-engine'
const execute = promisify(execFile)
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export type DiscoveryOptions = { platform?: NodeJS.Platform; home?: string; drives?: string[]; roots?: string[]; desktopConfig?: string; desktopCore?: string; signal?: AbortSignal }
export type DiscoveryResult = { installations: Installation[]; notes: string[] }
async function limitedText(path: string, maximum = 256 * 1024) {
  const file = await open(path, 'r')
  try { if ((await file.stat()).size > maximum) throw new Error('file too large'); const bytes = Buffer.alloc(maximum + 1); const { bytesRead } = await file.read(bytes, 0, bytes.length, 0); if (bytesRead > maximum) throw new Error('file too large'); return bytes.subarray(0, bytesRead).toString('utf8') }
  finally { await file.close() }
}
async function regularFile(path: string) { return stat(path).then(info => info.isFile()).catch(() => false) }
async function executableForPlatform(path: string, platform: NodeJS.Platform) {
  try {
    if (!await regularFile(path)) return false
    const file = await open(path, 'r'), bytes = Buffer.alloc(4)
    try { await file.read(bytes, 0, 4, 0) } finally { await file.close() }
    if (platform === 'win32') return bytes.subarray(0, 2).toString() === 'MZ'
    await access(path, constants.X_OK)
    return bytes.toString('hex') === '7f454c46' || bytes.subarray(0, 2).toString() === '#!'
  } catch { return false }
}
export async function installationFingerprint(binding: NonNullable<Settings['engineBinding']>) {
  const paths = [join(binding.directory, 'main.py'), join(binding.directory, 'comfy/cli_args.py'), join(binding.directory, 'server.py'), binding.python]
  return hash(await Promise.all(paths.map(async path => { const info = await stat(path); return [await realpath(path), info.size, info.mtimeMs, info.ino] })))
}
async function fixedDrives(): Promise<string[]> {
  try {
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object -ExpandProperty DeviceID | ConvertTo-Json -Compress"], { windowsHide: true, shell: false, timeout: 4000, maxBuffer: 8192 })
    const value: unknown = JSON.parse(stdout)
    return (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === 'string' && /^[A-Z]:$/i.test(item)).map(item => `${item}\\`)
  } catch { return [] }
}
/** Bounded, read-only discovery. Does not execute an interpreter, app metadata or a workflow. */
export async function discoverEngines(binding: Settings['engineBinding'], directory?: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const platform = options.platform || process.platform, home = options.home || homedir(), notes: string[] = []
  const candidates = new Map<string, { directory: string; kind: Installation['kind']; python?: string; extraPython?: string[] }>()
  const stop = () => options.signal?.throwIfAborted()
  const add = (path: string, kind: Installation['kind'] = 'folder', python?: string, extraPython?: string[]) => {
    if (!isAbsolute(path) || path.includes('\0') || candidates.size >= 220) return
    const key = platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)
    if (!candidates.has(key)) candidates.set(key, { directory: resolve(path), kind, python, extraPython })
  }
  const expand = (path: string, kind: Installation['kind'] = 'folder') => { add(path, kind); add(join(path, 'ComfyUI'), kind === 'folder' ? 'portable' : kind); add(join(path, 'app'), kind); add(join(path, 'app', 'ComfyUI'), kind); add(join(path, 'resources', 'ComfyUI'), 'desktop') }
  const pythonPaths = (base: string) => platform === 'win32' ? ['.venv/Scripts/python.exe', 'venv/Scripts/python.exe', 'env/Scripts/python.exe', 'python_embeded/python.exe', 'python_embedded/python.exe'].map(p => join(base, p)) : ['.venv/bin/python', 'venv/bin/python', 'env/bin/python', '.venv/bin/python3', 'venv/bin/python3', 'env/bin/python3'].map(p => join(base, p))
  if (binding && !directory) add(binding.directory, 'linked', binding.python)
  const pinokioRoots = new Set<string>()
  if (directory) { expand(directory); pinokioRoots.add(directory) }
  else {
    const bases = options.roots || [home, join(home, 'Desktop'), join(home, 'Documents'), join(home, 'Downloads'), join(home, 'AI'), join(home, 'Apps'), ...(platform === 'linux' ? ['/opt', '/srv'] : [])]
    for (const base of bases) {
      for (const name of ['ComfyUI', 'comfyui', 'ComfyUI_windows_portable', 'ComfyUI_windows_portable_nvidia']) expand(join(base, name))
      pinokioRoots.add(join(base, 'pinokio')); pinokioRoots.add(join(base, 'Pinokio'))
    }
    if (platform === 'win32') for (const drive of options.drives || await fixedDrives()) {
      for (const name of ['ComfyUI', 'comfyui', 'ComfyUI_windows_portable', 'ComfyUI_windows_portable_nvidia']) expand(join(drive, name))
      pinokioRoots.add(join(drive, 'pinokio'))
    }
    const config = options.desktopConfig || (platform === 'win32' ? join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'ComfyUI', 'config.json') : join(home, '.config', 'ComfyUI', 'config.json'))
    try {
      const metadata: unknown = JSON.parse(await limitedText(config, 32768))
      const base = metadata && typeof metadata === 'object' && 'basePath' in metadata ? metadata.basePath : null
      if (typeof base === 'string' && isAbsolute(base) && base.length <= 1000) {
        expand(base, 'desktop')
        const core = options.desktopCore || (platform === 'win32' ? join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'Programs', 'ComfyUI', 'resources', 'ComfyUI') : '')
        if (core) add(core, 'desktop', undefined, pythonPaths(base))
      }
    } catch { /* Desktop may not be installed or its configuration may be unavailable. */ }
  }
  for (const root of pinokioRoots) {
    stop()
    try {
      const folder = await opendirBounded(join(root, 'api'), 100)
      if (folder.limited) notes.push('Se alcanzó el límite de carpetas de una instalación de Pinokio. Puedes buscar en una carpeta concreta.')
      for (const name of folder.names) expand(join(root, 'api', name), 'pinokio')
    } catch { /* Missing/denied optional roots are not a claim that the app is absent. */ }
  }
  const deadline = Date.now() + 15000
  const installations: Installation[] = [], seen = new Set<string>()
  for (const candidate of candidates.values()) {
    stop()
    if (Date.now() > deadline) { notes.push('La búsqueda alcanzó su límite de tiempo. Puedes buscar en una carpeta concreta.'); break }
    if (!await regularFile(join(candidate.directory, 'main.py')) || !await regularFile(join(candidate.directory, 'folder_paths.py'))) continue
    const canonical = await realpath(candidate.directory).catch(() => candidate.directory), key = platform === 'win32' ? canonical.toLowerCase() : canonical
    if (seen.has(key)) continue
    seen.add(key)
    const paths = [candidate.python, ...candidate.extraPython || [], ...pythonPaths(candidate.directory), ...pythonPaths(dirname(candidate.directory))].filter((p): p is string => !!p)
    let python: string | null = null
    for (const path of paths) if (await executableForPlatform(path, platform)) { python = resolve(path); break }
    let available = false, reason = 'Encontramos archivos del motor, pero no un entorno Python compatible. Prueba otra carpeta o revisa los detalles avanzados.'
    if (python) {
      try {
        await validateEngineBinding({ directory: candidate.directory, python })
        const server = await limitedText(join(candidate.directory, 'server.py'))
        if (!server.includes('/api/jobs/{job_id}/cancel') || !server.includes('interrupt_if_running')) throw new Error('safe cancellation missing')
        available = true; reason = 'Los archivos necesarios están presentes. El arranque se comprobará durante la preparación.'
      } catch { reason = 'Esta instalación necesita atención: no se pudieron confirmar las capacidades requeridas. Sus archivos se conservarán.' }
    }
    const label = candidate.kind === 'linked' ? 'Tu instalación vinculada' : candidate.kind === 'pinokio' ? basename(dirname(candidate.directory)).replace(/\.git$/i, '').replace(/[-_]/g, ' ') : 'ComfyUI existente'
    installations.push({ id: hash([key, python]), name: label, kind: candidate.kind, directory: candidate.directory, python, available, reason })
    if (installations.length >= 16) { notes.push('Se muestran hasta 16 instalaciones. Puedes buscar en una carpeta concreta.'); break }
  }
  if (candidates.size >= 220) notes.push('La búsqueda alcanzó su límite de carpetas. Puedes buscar en una ubicación concreta.')
  if (platform === 'linux' && /microsoft/i.test((await import('node:os')).release())) notes.push('Veltria se ejecuta en WSL. Para reutilizar una instalación de Windows, abre Veltria para Windows.')
  return { installations, notes: [...new Set(notes)] }
}
async function opendirBounded(path: string, limit: number) {
  const { opendir } = await import('node:fs/promises'), folder = await opendir(path), names: string[] = []
  let limited = false, checked = 0
  try { for await (const entry of folder) { if (entry.isDirectory() || entry.isSymbolicLink()) names.push(entry.name); if (++checked >= limit) { limited = true; break } } }
  finally { await folder.close().catch(() => {}) }
  return { names: names.sort(), limited }
}
