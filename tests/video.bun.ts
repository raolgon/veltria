import { test, expect } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { createServer } from '../apps/local-service/src/server'
import { CreationFixture, fixtureHardware } from './creation-fixture'
import { VideoFixture } from './video-fixture'

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'Veltria video integration ')), ui = join(directory, 'ui')
  await mkdir(ui); await writeFile(join(ui, 'index.html'), '<title>fixture</title>')
  const image = new CreationFixture(), video = new VideoFixture(), binding = await image.binding(directory)
  const connect = async () => {
    const server = await createServer({ dataDir: directory, uiDir: ui, instanceId: crypto.randomUUID(), controlToken: 'a'.repeat(64), creation: { profile: image.profile, engine: image.engine, hardware: async () => fixtureHardware, allowLocalFixture: true }, video: video.options })
    const origin = await server.listen()
    const auth = await fetch(origin + '/api/v1/session', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: server.issueNonce() }) })
    const session: any = await auth.json(), headers = { cookie: auth.headers.get('set-cookie')!.split(';')[0], origin, 'content-type': 'application/json', 'x-veltria-csrf': session.csrf }
    const call = (path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) => fetch(origin + '/api/v1' + path, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) })
    const json = async (path: string) => await (await call(path)).json() as any
    return { server, origin, call, json }
  }
  const connection = await connect()
  await connection.call('/settings', 'PATCH', { engineBinding: binding, theme: 'dark', locale: 'en' })
  return { ...connection, connect, directory, image, video, async close() { await connection.server.close(); image.stop(); video.stop(); await rm(directory, { recursive: true, force: true }) } }
}
async function until<T>(get: () => Promise<T>, ready: (v: T) => boolean) { const deadline = Date.now() + 10000; do { const value = await get(); if (ready(value)) return value; await Bun.sleep(25) } while (Date.now() < deadline); throw new Error('video fixture timeout') }
async function prepare(ctx: Awaited<ReturnType<typeof setup>>) { const plan = await ctx.json('/video/plan'); expect((await ctx.call('/video/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptExperimental: true })).status).toBe(202); await until(() => ctx.json('/video'), value => value.canCreate); return plan }
test('video: autorización, preparación, idempotencia, MP4/rangos, biblioteca y reapertura', async () => {
  const ctx = await setup()
  try {
    const plan = await ctx.json('/video/plan'); expect(plan.downloadBytes).toBe(0)
    expect((await ctx.call('/video/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptExperimental: false })).status).toBe(400)
    await prepare(ctx)
    const input = { requestId: crypto.randomUUID(), prompt: 'Una pelota roja rueda. 日本語 stays literal.', preset: 'preview' }
    const first = await (await ctx.call('/video/jobs', 'POST', input)).json() as any
    const duplicate = await (await ctx.call('/video/jobs', 'POST', input)).json() as any
    expect(duplicate.id).toBe(first.id)
    const completed = await until(() => ctx.json(`/video/jobs/${first.id}`), value => value.status === 'completed')
    expect(ctx.video.submissions).toHaveLength(1); expect(ctx.video.submissions[0].prompt['6'].inputs.prompt).toBe(input.prompt)
    expect(completed.metadata.codec).toBe('h264'); expect(completed.sha256).toHaveLength(64)
    expect((await ctx.json('/video')).verifiedPresets).toContain('preview')
    const file = await ctx.call(`/video/artifacts/${first.id}`); const bytes = Buffer.from(await file.arrayBuffer()); expect(bytes.toString('ascii', 4, 8)).toBe('ftyp')
    expect((await fetch(`${ctx.origin}/api/v1/video/artifacts/${first.id}`)).status).toBe(401)
    const range = await ctx.call(`/video/artifacts/${first.id}`, 'GET', undefined, { range: 'bytes=4-7' }); expect(range.status).toBe(206); expect(await range.text()).toBe('ftyp')
    expect((await ctx.call(`/video/artifacts/${first.id}`, 'GET', undefined, { range: 'bytes=99999999999-' })).status).toBe(416)
    expect((await ctx.call(`/video/artifacts/${first.id}`, 'GET', undefined, { range: 'bytes=-0' })).status).toBe(416)
    const suffix = await ctx.call(`/video/artifacts/${first.id}`, 'GET', undefined, { range: 'bytes=-8' }); expect(suffix.status).toBe(206); expect((await suffix.arrayBuffer()).byteLength).toBe(8)
    const download = await ctx.call(`/video/artifacts/${first.id}?download=1`); expect(download.headers.get('content-disposition')).toContain('.mp4'); await download.arrayBuffer()
    await ctx.server.close(); const reopened = await ctx.connect()
    try { expect((await reopened.json('/video/jobs')).jobs[0].prompt).toBe(input.prompt); expect((await reopened.json('/settings')).locale).toBe('en'); const artifact = await reopened.call(`/video/artifacts/${first.id}`); expect(artifact.status).toBe(200); await artifact.arrayBuffer() } finally { await reopened.server.close() }
  } finally { await ctx.close() }
}, 25000)
test('video: exclusión con imágenes, cancelación propia y cambios de componentes', async () => {
  const ctx = await setup(); ctx.video.complete = false
  try {
    await prepare(ctx)
    expect((await ctx.call('/video/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'fixture', preset: 'short' })).status).toBe(409)
    const job = await (await ctx.call('/video/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'fixture', preset: 'preview' })).json() as any
    await until(() => ctx.json(`/video/jobs/${job.id}`), value => value.status === 'running')
    expect((await ctx.call('/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'image' })).status).toBe(409)
    expect((await ctx.call('/settings', 'PATCH', { modelsDirectory: join(ctx.directory, 'different') })).status).toBe(409)
    expect((await ctx.call(`/video/jobs/${job.id}/cancel`, 'POST', {})).status).toBe(200)
    expect(ctx.video.cancellations).toEqual([job.id])
    await Bun.sleep(1100); ctx.video.modified++
    expect((await ctx.call('/video/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'new', preset: 'preview' })).status).toBe(409)
    expect(ctx.video.submissions).toHaveLength(1)
  } finally { await ctx.close() }
})
test('video: respuesta perdida y reinicio recuperan el resultado sin reenviar', async () => {
  const ctx = await setup(); ctx.video.lostResponse = true
  try {
    await prepare(ctx)
    const job = await (await ctx.call('/video/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'fixture', preset: 'preview' })).json() as any
    await until(() => ctx.json(`/video/jobs/${job.id}`), value => value.status === 'interrupted')
    await ctx.server.close(); const reopened = await ctx.connect()
    try { const response = await reopened.call(`/video/jobs/${job.id}/reconcile`, 'POST', {}); expect(response.status).toBe(200); expect((await reopened.json(`/video/jobs/${job.id}`)).status).toBe('completed'); expect(ctx.video.submissions).toHaveLength(1) } finally { await reopened.server.close() }
  } finally { await ctx.close() }
})
test('video: faltan archivos, falla el motor y se rechazan resultados ajenos', async () => {
  const ctx = await setup()
  try {
    ctx.video.componentsValid = false; expect((await ctx.json('/video/plan')).canPrepare).toBe(false)
    ctx.video.componentsValid = true; await prepare(ctx); ctx.video.badOutput = true
    const job = await (await ctx.call('/video/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'fixture', preset: 'preview' })).json() as any
    await until(() => ctx.json(`/video/jobs/${job.id}`), value => value.status === 'failed')
    expect((await ctx.call(`/video/artifacts/${job.id}`)).status).toBe(404)
    expect(await readdir(join(ctx.directory, 'videos')).catch(() => [])).toEqual([])
  } finally { await ctx.close() }
})
test('video: migra esquema 2 sin perder preferencias y conserva copia de SQLite', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'Veltria video migration ')), ui = join(directory, 'ui')
  await mkdir(ui); await writeFile(join(ui, 'index.html'), '<title>fixture</title>')
  const db = new Database(join(directory, 'settings.sqlite')); db.exec('CREATE TABLE settings (id INTEGER PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=2;'); db.query('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({ theme: 'dark', locale: 'en', engineUrl: null })); db.close()
  const server = await createServer({ dataDir: directory, uiDir: ui, instanceId: crypto.randomUUID(), controlToken: 'a'.repeat(64) })
  try { expect(server.repository.get().locale).toBe('en'); expect((server.repository.db.query('PRAGMA user_version').get() as any).user_version).toBe(4); expect(await readdir(join(directory, 'backups'))).toHaveLength(1) } finally { await server.close(); await rm(directory, { recursive: true, force: true }) }
})
