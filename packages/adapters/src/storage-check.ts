import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SettingsRepository } from './settings'
/** Executes against a disposable DB in both source and compiled distribution. */
export async function checkStorage() {
  const directory = await mkdtemp(join(tmpdir(), 'veltria storage ')), file = join(directory, 'settings.sqlite')
  let repo = new SettingsRepository(file)
  try {
    repo.update({ theme: 'dark' })
    try { repo.db.transaction(() => { repo.update({ theme: 'light' }); throw new Error('expected rollback') })() } catch {}
    if (repo.get().theme !== 'dark') throw new Error('Rollback falló')
    repo.close(); repo = new SettingsRepository(file)
    if (repo.get().theme !== 'dark') throw new Error('Reapertura falló')
    const version = (repo.db.query('PRAGMA user_version').get() as { user_version: number }).user_version
    if (version !== 1) throw new Error('Migración falló')
    return { migration: true, transaction: true, rollback: true, reopen: true }
  } finally { repo.close(); await rm(directory, { recursive: true, force: true }) }
}
