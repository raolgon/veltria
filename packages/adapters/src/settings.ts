import { Database } from 'bun:sqlite'
import { settingsSchema, type Settings } from '@veltria/contracts'

/** Service-only repository. Migration and updates are atomic; never imported by Electron/UI. */
export class SettingsRepository {
  readonly db: Database
  constructor(path: string) {
    this.db = new Database(path, { create: true, strict: true })
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;')
    const version = (this.db.query('PRAGMA user_version').get() as { user_version: number }).user_version
    if (version > 4) { this.db.close(); throw new Error('La base pertenece a una versión posterior de Veltria.') }
    this.db.transaction(() => {
      this.db.exec('CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)')
      this.db.query('INSERT OR IGNORE INTO settings VALUES (1, ?)').run(JSON.stringify({ theme: 'system', engineUrl: null }))
      if (version < 1) this.db.exec('PRAGMA user_version=1')
    })()
  }
  get(): Settings {
    return settingsSchema.parse(JSON.parse((this.db.query('SELECT value FROM settings WHERE id=1').get() as { value: string }).value))
  }
  update(patch: Partial<Settings>): Settings {
    return this.db.transaction(() => {
      const next = settingsSchema.parse({ ...this.get(), ...patch })
      this.db.query('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(next))
      return next
    })()
  }
  close() { this.db.close() }
}
