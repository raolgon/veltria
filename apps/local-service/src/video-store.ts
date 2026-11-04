import type { Database } from 'bun:sqlite'
import { videoJobSchema, type VideoJob, type VideoState } from '@veltria/contracts'
export class VideoStore {
  constructor(private db: Database) {
    db.transaction(() => {
      if ((db.query('PRAGMA user_version').get() as {user_version: number}).user_version < 3) db.exec('PRAGMA user_version=3')
      db.exec('CREATE TABLE IF NOT EXISTS video_jobs (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, created TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS video_jobs_created ON video_jobs(created DESC); CREATE TABLE IF NOT EXISTS video_preparation (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS video_acceptances (revision TEXT PRIMARY KEY, data TEXT NOT NULL);')
    })()
  }
  job(id: string) { const row = this.db.query('SELECT data FROM video_jobs WHERE id=?').get(id) as { data: string } | null; return row ? videoJobSchema.parse(JSON.parse(row.data)) : null }
  byRequest(id: string) { const row = this.db.query('SELECT data FROM video_jobs WHERE request_id=?').get(id) as { data: string } | null; return row ? videoJobSchema.parse(JSON.parse(row.data)) : null }
  jobs(offset = 0, limit = 24) { return (this.db.query('SELECT data FROM video_jobs ORDER BY created DESC LIMIT ? OFFSET ?').all(limit, offset) as { data: string }[]).map(row => videoJobSchema.parse(JSON.parse(row.data))) }
  count() { return (this.db.query('SELECT COUNT(*) AS n FROM video_jobs').get() as { n: number }).n }
  save(job: VideoJob) { this.db.query('INSERT INTO video_jobs VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(job.id, job.requestId, job.createdAt, JSON.stringify(videoJobSchema.parse(job))) }
  preparation(): VideoState['preparation'] | null { const row = this.db.query('SELECT data FROM video_preparation WHERE id=1').get() as { data: string } | null; return row ? JSON.parse(row.data) : null }
  savePreparation(preparation: VideoState['preparation']) { this.db.query('INSERT INTO video_preparation VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(preparation)) }
  authorize(revision: string, plan: unknown) { this.db.query('INSERT OR IGNORE INTO video_acceptances VALUES (?,?)').run(revision, JSON.stringify({ plan, acceptedAt: new Date().toISOString() })) }
  authorized(revision: string) { return !!this.db.query('SELECT revision FROM video_acceptances WHERE revision=?').get(revision) }
}
