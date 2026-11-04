import { describe, expect, it } from 'vitest'
import { translate, bytes } from '@veltria/core'
import { english } from '../packages/core/src/english'
import { settingsSchema, settingsPatchSchema } from '@veltria/contracts'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchService } from '../scripts/supervisor'

describe('español e inglés', () => {
  it('traduce texto fijo y estados dinámicos sin alterar los datos insertados', () => {
    expect(translate('Ajustes', 'en')).toBe('Settings')
    expect(translate('Ajustes', 'es')).toBe('Ajustes')
    expect(translate('Creando la imagen · paso 4 de 20', 'en')).toBe('Creating your image · step 4 of 20')
    const name = 'NVIDIA Crear $& {2}'
    const source = 'Tu {0} cumple los mínimos de este perfil a 512 píxeles. La recomendación inicial se basa en recursos; la primera imagen comprobará la ejecución.'
    expect(translate(source, 'en', { 0: name })).toContain(name)
    expect(translate(source.replace('{0}', () => name), 'en')).toContain(name)
    expect(translate('Custom engine diagnostic', 'en')).toBe('Custom engine diagnostic')
    expect(translate('constructor', 'en')).toBe('constructor')
    expect(translate('No se pudo comprobar ComfyUI (Respuesta vacía). Revisa que esté abierto y vuelve a comprobar; su instalación no se ha modificado.', 'en')).toContain('(Empty response)')
  })
  it('conserva los mismos parámetros en todos los mensajes traducidos', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort()
    for (const [source, target] of Object.entries(english)) {
      expect(target.trim(), source).not.toBe('')
      expect(placeholders(target), source).toEqual(placeholders(source))
    }
  })
  it('localiza medidas y distingue desconocido de cero', () => {
    expect(bytes(null, 'en')).toBe('Unknown')
    expect(bytes(0, 'en')).toBe('0 B')
    expect(bytes(1.5 * 1024 ** 3, 'en')).toBe('1.5 GiB')
    expect(bytes(1.5 * 1024 ** 3, 'es')).toBe('1,5 GiB')
  })
  it('lee preferencias anteriores en español sin introducir valores al parchear', () => {
    expect(settingsSchema.parse({ theme: 'dark', engineUrl: null }).locale).toBe('es')
    expect(settingsPatchSchema.parse({ locale: 'en' })).toEqual({ locale: 'en' })
    expect(settingsPatchSchema.parse({ theme: 'dark' })).toEqual({ theme: 'dark' })
    expect(settingsPatchSchema.safeParse({ locale: 'fr' }).success).toBe(false)
  })
  it('conserva el bloqueo y los datos de un servicio anterior sin iniciar otro proceso', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'Veltria older protocol '))
    try {
      await mkdir(join(directory, '.service-lock'))
      await writeFile(join(directory, '.service-lock/instance.json'), JSON.stringify({ name: 'veltria', protocol: 2, platform: process.platform, pid: process.pid }))
      await writeFile(join(directory, 'settings.sqlite'), 'preserved fixture data')
      await expect(launchService({ executable: '/missing-helper-must-not-start', dataDir: directory, uiDir: directory })).rejects.toThrow('Hay otra versión de Veltria abierta.')
      expect(await readFile(join(directory, 'settings.sqlite'), 'utf8')).toBe('preserved fixture data')
      expect(JSON.parse(await readFile(join(directory, '.service-lock/instance.json'), 'utf8')).protocol).toBe(2)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
