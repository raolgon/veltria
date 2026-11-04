import os from 'node:os'
import { readFile, statfs } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resourcesSchema, type Resources } from '@veltria/contracts'

const exec = promisify(execFile)
type CpuTimes = { idle: number; total: number }
export function cpuUsage(previous: CpuTimes, current: CpuTimes): number | null {
  const total = current.total - previous.total, idle = current.idle - previous.idle
  return total > 0 && idle >= 0 && idle <= total ? Math.round((1 - idle / total) * 100) : null
}
function cpuTimes(): CpuTimes {
  return os.cpus().reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle, total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 })
}
function memory(total: number | null, available: number | null) {
  return { total, available, used: total !== null && available !== null ? Math.max(0, total - available) : null }
}
export function parseGpuResources(text: string): Resources['gpus'] {
  const number = (value: string | undefined) => value?.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
  return text.trim().split('\n').flatMap(line => {
    const [name, utilization, total, used, free] = line.split(',').map(v => v.trim())
    if (!name || total === undefined) return []
    const mib = (value: string | undefined) => { const n = number(value); return n === null ? null : n * 1024 ** 2 }
    const percent = number(utilization)
    return [{ name, percent: percent !== null && percent <= 100 ? percent : null, memory: { total: mib(total), used: mib(used), available: mib(free) } }]
  })
}

/** Demand driven: one bounded sample shared by all local clients, no background timer. */
export class ResourceMonitor {
  private previous = cpuTimes()
  private cached: Resources | null = null
  private cachedAt = -Infinity
  private pending: Promise<Resources> | null = null
  private retryGpuAt = -Infinity
  constructor(private dataDir: string) {}
  sample(): Promise<Resources> {
    if (this.pending) return this.pending
    if (this.cached && performance.now() - this.cachedAt < 2500) return Promise.resolve(this.cached)
    this.pending = this.read().then(value => { this.cached = value; this.cachedAt = performance.now(); return value }).finally(() => { this.pending = null })
    return this.pending
  }
  private async read(): Promise<Resources> {
    const platform = os.platform(), wsl = platform === 'linux' && /microsoft/i.test(os.release())
    const [ram, disk, gpus] = await Promise.all([
      (async () => {
        if (platform === 'linux') {
          try {
            const text = await readFile('/proc/meminfo', 'utf8')
            const total = /MemTotal:\s+(\d+)/.exec(text), available = /MemAvailable:\s+(\d+)/.exec(text)
            if (total && available) return memory(Number(total[1]) * 1024, Number(available[1]) * 1024)
          } catch { /* fall back to OS free memory */ }
        }
        return memory(os.totalmem(), os.freemem())
      })(),
      (async () => {
        try { const value = await statfs(this.dataDir); return { ...memory(value.blocks * value.bsize, value.bavail * value.bsize), path: this.dataDir } }
        catch { return { ...memory(null, null), path: this.dataDir } }
      })(),
      (async () => {
        if (performance.now() < this.retryGpuAt || !['win32', 'linux'].includes(platform)) return []
        try {
          const value = await exec(wsl ? '/usr/lib/wsl/lib/nvidia-smi' : 'nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.total,memory.used,memory.free', '--format=csv,noheader,nounits'], { timeout: 1500, maxBuffer: 64_000, windowsHide: true, shell: false })
          return parseGpuResources(value.stdout)
        } catch { this.retryGpuAt = performance.now() + 30_000; return [] }
      })()
    ])
    const current = cpuTimes(), percent = cpuUsage(this.previous, current)
    this.previous = current
    return resourcesSchema.parse({ sampledAt: new Date().toISOString(), platform, wsl, cpu: { percent }, ram, disk, gpus })
  }
}
