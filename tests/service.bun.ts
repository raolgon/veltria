import { test, expect } from 'bun:test'
import { checkStorage } from '../packages/adapters/src/storage-check'
import { SettingsRepository } from '../packages/adapters/src/settings'
import { Database } from 'bun:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
test('bun:sqlite: migración, transacción, rollback y reapertura real', async () => {
  expect(await checkStorage()).toEqual({ migration: true, transaction: true, rollback: true, reopen: true })
})
test('idioma: preferencias anteriores y reapertura conservan tema, vínculo y ubicación', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'Veltria language ')), path = join(directory, 'settings.sqlite')
  let repository: SettingsRepository | undefined
  try {
    const legacy = new Database(path)
    legacy.exec('CREATE TABLE settings (id INTEGER PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=2')
    const binding = { directory: '/existing/ComfyUI', python: '/existing/python' }
    legacy.query('INSERT INTO settings VALUES (1, ?)').run(JSON.stringify({ theme: 'dark', engineUrl: null, engineBinding: binding, modelsDirectory: '/existing/models' }))
    legacy.close()
    repository = new SettingsRepository(path)
    expect(repository.get().locale).toBe('es')
    repository.update({ locale: 'en' }); repository.close()
    repository = new SettingsRepository(path)
    expect(repository.get()).toMatchObject({ locale: 'en', theme: 'dark', engineBinding: binding, modelsDirectory: '/existing/models' })
    repository.update({ theme: 'light' })
    expect(repository.get().locale).toBe('en')
  } finally { repository?.close(); await rm(directory, { recursive: true, force: true }) }
})
