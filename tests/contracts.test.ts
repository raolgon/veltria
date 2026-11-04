import { describe, it, expect } from 'vitest'
import { engineUrlSchema, settingsPatchSchema, readySchema, protocol } from '@veltria/contracts'
import { bytes } from '@veltria/core'
describe('contratos de la frontera local', () => {
  it('rechaza destinos de red, credenciales, rutas y esquemas', () => {
    for (const value of ['https://127.0.0.1:8188', 'http://192.168.1.2:8188', 'http://example.com', 'http://127.0.0.1/a', 'http://user:secret@localhost', 'http://localhost/?x=1', 'file:///etc/passwd', 'http://127.0.0.1/#x']) expect(engineUrlSchema.safeParse(value).success, value).toBe(false)
  })
  it('normaliza localhost sin DNS y admite loopback IPv6', () => {
    expect(engineUrlSchema.parse('http://localhost:8188/')).toBe('http://127.0.0.1:8188')
    expect(engineUrlSchema.parse('http://[::1]:8188')).toBe('http://[::1]:8188')
  })
  it('rechaza ajustes desconocidos y capacidades simuladas', () => {
    expect(settingsPatchSchema.safeParse({ theme: 'green' }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ shell: 'anything' }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({}).success).toBe(false)
    expect(readySchema.safeParse({ name: 'veltria', protocol: 2 }).success).toBe(false)
  })
  it('distingue memoria desconocida de cero', () => {
    expect(bytes(null)).toBe('Desconocido'); expect(bytes(0)).toBe('0 B')
    expect(bytes(1024 * 1024)).toBe('1 MiB')
  })
  it('un cambio de apariencia conserva el vínculo y la ubicación existentes', () => {
    expect(settingsPatchSchema.parse({ theme: 'dark' })).toEqual({ theme: 'dark' })
  })
  it('el contrato bilingüe rechaza auxiliares anteriores antes de mezclar preferencias', () => {
    const ready = { name: 'veltria', protocol, instanceId: 'test', origin: 'http://127.0.0.1:1234', nonce: 'a'.repeat(64) }
    expect(readySchema.safeParse(ready).success).toBe(true)
    expect(readySchema.safeParse({ ...ready, protocol: 2 }).success).toBe(false)
    expect(readySchema.safeParse({ ...ready, protocol: 3 }).success).toBe(false)
  })
})
