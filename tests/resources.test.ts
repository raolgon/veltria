import { describe, expect, it } from 'vitest'
import { cpuUsage, parseGpuResources, ResourceMonitor } from '../packages/adapters/src/resources'
import { resourcesSchema } from '@veltria/contracts'
import { tmpdir } from 'node:os'

describe('lecturas de recursos reales', () => {
  it('mide CPU entre muestras, distingue reposo, reinicio y ausencia de intervalo', () => {
    expect(cpuUsage({ idle: 100, total: 200 }, { idle: 175, total: 300 })).toBe(25)
    expect(cpuUsage({ idle: 100, total: 200 }, { idle: 200, total: 300 })).toBe(0)
    expect(cpuUsage({ idle: 100, total: 200 }, { idle: 100, total: 200 })).toBeNull()
    expect(cpuUsage({ idle: 100, total: 200 }, { idle: 1, total: 2 })).toBeNull()
  })
  it('conserva múltiples GPU, memoria en bytes y sensores no disponibles sin inventar ceros', () => {
    const values = parseGpuResources('RTX 4050, 0, 6144, 2048, 4096\nRTX 4060, [N/A], 8192, [N/A], [N/A]')
    expect(values).toHaveLength(2)
    expect(values[0]).toMatchObject({ percent: 0, memory: { total: 6144 * 1024 ** 2, used: 2048 * 1024 ** 2, available: 4096 * 1024 ** 2 } })
    expect(values[1]).toMatchObject({ percent: null, memory: { used: null, available: null } })
    expect(parseGpuResources('')).toEqual([])
  })
  it('comparte una muestra concurrente y reutiliza la caché sin nuevos procesos por cliente', async () => {
    const monitor = new ResourceMonitor(tmpdir())
    const first = monitor.sample(), second = monitor.sample()
    expect(first).toBe(second)
    const value = resourcesSchema.parse(await first)
    expect(value.ram.total).toBeGreaterThan(0)
    expect(value.disk.available).toBeGreaterThan(0)
    expect(await monitor.sample()).toBe(await first)
  })
})
