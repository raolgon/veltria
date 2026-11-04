import os from 'node:os'
import { readFile, statfs } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { hardwareSchema, type Hardware } from '@veltria/contracts'
const exec = promisify(execFile)
async function command(file: string, args: string[]): Promise<string> {
  return (await exec(file, args, { timeout: 4000, maxBuffer: 512_000, windowsHide: true, shell: false })).stdout
}
export async function detectHardware(dataDir: string): Promise<Hardware> {
  const platform = os.platform(), release = os.release(), wsl = platform === 'linux' && /microsoft/i.test(release)
  const result: Hardware = {
    sampledAt: new Date().toISOString(), host: os.hostname(), platform, arch: os.arch(), release, wsl,
    cpu: { name: os.cpus()[0]?.model || null, logicalCores: os.cpus().length, source: 'node:os (host del servicio)' },
    ram: { total: os.totalmem(), available: os.freemem(), source: 'node:os; memoria libre, no estimación de memoria recuperable' },
    disk: { total: null, available: null, source: 'node:fs.statfs', path: dataDir }, gpus: [], notes: []
  }
  if (wsl) result.notes.push('Servicio en WSL: CPU/RAM/disco corresponden al entorno Linux; no son un inventario completo del host Windows. La GPU puede estar expuesta por el controlador Windows.')
  if (platform === 'linux') {
    try {
      const mem = await readFile('/proc/meminfo', 'utf8')
      const total = /MemTotal:\s+(\d+)/.exec(mem), available = /MemAvailable:\s+(\d+)/.exec(mem)
      if (total && available) result.ram = { total: Number(total[1]) * 1024, available: Number(available[1]) * 1024, source: '/proc/meminfo: MemTotal y MemAvailable' }
    } catch { result.notes.push('No se pudo consultar /proc/meminfo; se informa memoria libre desde el SO.') }
  }
  try {
    const disk = await statfs(dataDir)
    result.disk.total = disk.blocks * disk.bsize
    result.disk.available = disk.bavail * disk.bsize
  } catch { result.notes.push('No se pudo medir el disco del directorio de datos.') }
  try {
    const binary = wsl ? '/usr/lib/wsl/lib/nvidia-smi' : 'nvidia-smi'
    const text = await command(binary, ['--query-gpu=name,memory.total,memory.free,driver_version', '--format=csv,noheader,nounits'])
    for (const line of text.trim().split('\n')) {
      const [name, total, free, driver] = line.split(',').map(v => v.trim())
      if (!name) continue
      const number = (v: string | undefined) => v && Number.isFinite(Number(v)) ? Number(v) * 1024 ** 2 : null
      result.gpus.push({ name, vramTotal: number(total), vramAvailable: number(free), driver: driver || null, source: `${binary}: consulta NVIDIA (MiB)` })
    }
  } catch {
    if (platform === 'win32') {
      try {
        // Fixed script, no input interpolation. CIM AdapterRAM is a 32-bit value, not reliable VRAM.
        const script = 'Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion | ConvertTo-Json -Compress'
        const controllers = JSON.parse(await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]))
        for (const gpu of Array.isArray(controllers) ? controllers : [controllers]) {
          if (typeof gpu?.Name === 'string') result.gpus.push({ name: gpu.Name, vramTotal: null, vramAvailable: null, driver: gpu.DriverVersion ?? null, source: 'Windows CIM Win32_VideoController; VRAM desconocida' })
        }
      } catch { result.notes.push('No se pudo consultar Windows CIM ni NVIDIA. GPU desconocida.') }
    } else if (platform === 'linux') {
      try {
        const text = await command('lspci', ['-mm'])
        for (const line of text.split('\n').filter(v => /VGA|3D controller|Display controller/i.test(v))) {
          result.gpus.push({ name: line, vramTotal: null, vramAvailable: null, driver: null, source: 'lspci: identidad PCI; memoria/controlador desconocidos' })
        }
      } catch { result.notes.push('Sin consulta NVIDIA ni lspci utilizable: GPU desconocida, no se afirma su ausencia.') }
    }
  }
  if (platform === 'darwin') result.notes.push('macOS pendiente de validación real. GPU, memoria unificada y soporte MPS sin verificar.')
  result.notes.push('La memoria disponible cambia con otras aplicaciones. No se ha verificado un perfil ni medido generación.')
  return hardwareSchema.parse(result)
}
