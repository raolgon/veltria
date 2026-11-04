import type { Database } from 'bun:sqlite'
import { preparationSchema, jobSchema, type Preparation, type ImageJob, imageConfigurationSchema, type ConfigurationEntry } from '@veltria/contracts'

export class CreationStore {
  constructor(private db: Database) {
    db.transaction(() => {
      const version = (db.query('PRAGMA user_version').get() as { user_version: number }).user_version
      if (version < 4) db.exec('PRAGMA user_version=4')
      db.exec('CREATE TABLE IF NOT EXISTS image_configurations (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS image_selection (id INTEGER PRIMARY KEY CHECK(id=1), configuration TEXT NOT NULL)')
      db.exec('CREATE TABLE IF NOT EXISTS preparations (profile TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS image_jobs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, created TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS image_jobs_created ON image_jobs(created DESC); CREATE TABLE IF NOT EXISTS image_evidence (profile TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS preparation_acceptances (revision TEXT PRIMARY KEY, data TEXT NOT NULL);')
    })()
  }
  configurations(): ConfigurationEntry[] {
    return (this.db.query('SELECT id,data FROM image_configurations ORDER BY rowid DESC').all() as {id: string; data: string}[]).map(row => ({ id: row.id, configuration: imageConfigurationSchema.parse(JSON.parse(row.data)), origin: 'imported' }))
  }
  saveConfiguration(entry: ConfigurationEntry) { this.db.query('INSERT OR IGNORE INTO image_configurations VALUES (?,?)').run(entry.id, JSON.stringify(imageConfigurationSchema.parse(entry.configuration))) }
  selection(): string | null { return (this.db.query('SELECT configuration FROM image_selection WHERE id=1').get() as {configuration: string} | null)?.configuration || null }
  select(id: string) { this.db.query('INSERT INTO image_selection VALUES (1,?) ON CONFLICT(id) DO UPDATE SET configuration=excluded.configuration').run(id) }
  preparation(profile: string): Preparation | null {
    const row = this.db.query('SELECT data FROM preparations WHERE profile=?').get(profile) as { data: string } | null
    return row ? preparationSchema.parse(JSON.parse(row.data)) : null
  }
  savePreparation(preparation: Preparation) {
    this.db.query('INSERT INTO preparations VALUES (?,?) ON CONFLICT(profile) DO UPDATE SET data=excluded.data').run(preparation.profileId, JSON.stringify(preparationSchema.parse(preparation)))
  }
  authorize(revision: string, plan: unknown) {
    this.db.query('INSERT OR IGNORE INTO preparation_acceptances VALUES (?,?)').run(revision, JSON.stringify({ acceptedAt: new Date().toISOString(), plan }))
  }
  saveJob(job: ImageJob) {
    this.db.query('INSERT INTO image_jobs VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(job.id, job.requestId, job.createdAt, JSON.stringify(jobSchema.parse(job)))
  }
  job(id: string): ImageJob | null {
    const row = this.db.query('SELECT data FROM image_jobs WHERE id=?').get(id) as { data: string } | null
    return row ? jobSchema.parse(JSON.parse(row.data)) : null
  }
  byRequest(id: string): ImageJob | null {
    const row = this.db.query('SELECT data FROM image_jobs WHERE request_id=?').get(id) as { data: string } | null
    return row ? jobSchema.parse(JSON.parse(row.data)) : null
  }
  jobs(offset = 0, limit = 40): ImageJob[] {
    return (this.db.query('SELECT data FROM image_jobs ORDER BY created DESC LIMIT ? OFFSET ?').all(limit, offset) as { data: string }[]).map(row => jobSchema.parse(JSON.parse(row.data)))
  }
  count() { return (this.db.query('SELECT count(*) AS n FROM image_jobs').get() as { n: number }).n }
  evidence(profile: string): { hardwareKey: string; engineVersion: string; width: number; height: number; at: string } | null {
    const row = this.db.query('SELECT data FROM image_evidence WHERE profile=?').get(profile) as { data: string } | null
    return row ? JSON.parse(row.data) : null
  }
  saveEvidence(profile: string, value: NonNullable<ReturnType<CreationStore['evidence']>>) {
    this.db.query('INSERT INTO image_evidence VALUES (?,?) ON CONFLICT(profile) DO UPDATE SET data=excluded.data').run(profile, JSON.stringify(value))
  }
}
