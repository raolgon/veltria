import { test, expect } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from '../apps/local-service/src/server'
import { CreationFixture, fixtureHardware } from './creation-fixture'
import type { ManagedRecipe } from '../apps/local-service/src/managed'

async function until(work: () => Promise<any>, predicate: (s: any) => boolean) {
  for (let n = 0; n < 500; n++) { const value = await work(); if (predicate(value)) return value; await Bun.sleep(20) }
  throw new Error('Managed fixture timeout')
}
async function context() {
  const root = await mkdtemp(join(tmpdir(), 'veltria-managed-')), ui = join(root, 'ui')
  await mkdir(ui); await writeFile(join(ui, 'index.html'), '<title>fixture</title>')
  const fixture = new CreationFixture(); fixture.downloadDelay = 1
  let available = 100 * 1024 ** 3, installs = 0, broken = false, slow = false, transfers = 0, ranges = 0
  let installFailure: string | null = null
  let errorWriteFails = false
  let authorizationWriteFails = false
  let existingAvailable = false
  const bytes = Buffer.alloc(16384, 23), hash = createHash('sha256').update(bytes).digest('hex')
  const origin = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    transfers++; if (slow) await Bun.sleep(500)
    const offset = Number(request.headers.get('range')?.match(/bytes=(\d+)/)?.[1] || 0)
    if (offset) ranges++
    return new Response((broken ? Buffer.alloc(bytes.length, 99) : bytes).subarray(offset), { status: offset ? 206 : 200, headers: { 'content-length': String(bytes.length - offset), ...(offset ? { 'content-range': `bytes ${offset}-${bytes.length - 1}/${bytes.length}` } : {}) } })
  } })
  const artifact = (filename: string) => ({ filename, url: `http://127.0.0.1:${origin.port}/${filename}`, bytes: bytes.length, sha256: hash })
  const recipe: ManagedRecipe = { id: 'fixture-managed', platform: process.platform, arch: 'x64', comfy: artifact('comfy.tar.gz'), python: artifact('python.tar.gz'), uv: artifact('uv.tar.gz'), wheels: [], requirements: '', licenses: ['Fixture only; no executable downloaded'] }
  const open = () => createServer({ dataDir: root, uiDir: ui, controlToken: 'c'.repeat(64), instanceId: crypto.randomUUID(),
    creation: { profile: fixture.profile, hardware: async () => fixtureHardware, disk: async () => available, engine: fixture.engine, allowLocalFixture: true },
    setup: { discover: async () => ({ installations: existingAvailable ? [{ id: 'e'.repeat(64), name: 'Existing fixture', kind: 'folder' as const, directory: join(root, 'external'), python: join(root, 'external', 'python'), available: true, reason: 'Fixture only' }] : [], notes: [] }) },
    managed: { recipe, allowLocalFixture: true, disk: async () => available, install: async (directory, signal) => {
      signal.throwIfAborted(); installs++
      if (installFailure) {
        await writeFile(join(directory, 'interrupted-install'), 'partial installation')
        if (process.platform === 'linux' && installFailure === 'ENOSPC') await writeFile('/dev/full', 'fixture write')
        if (process.platform === 'linux' && process.getuid?.() !== 0 && installFailure === 'EACCES') {
          await chmod(directory, 0o500)
          try { await writeFile(join(directory, 'denied-write'), 'fixture write') } finally { await chmod(directory, 0o700) }
        }
        throw Object.assign(new Error(installFailure), { code: installFailure })
      }
      const binding = { directory: join(directory, 'ComfyUI-0.35.0'), python: join(directory, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3') }
      await mkdir(binding.directory, { recursive: true }); return binding
    } } })
  let server: Awaited<ReturnType<typeof open>>, url = '', cookie = '', csrf = ''
  const call = (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => fetch(url + '/api/v1' + path, { method, headers: { origin: url, cookie, 'content-type': 'application/json', 'x-veltria-csrf': csrf }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = async (path: string) => (await call(path)).json() as any
  async function reopen() {
    server = await open(); url = await server.listen()
    const query = server.repository.db.query.bind(server.repository.db)
    ;(server.repository.db as any).query = (sql: string, ...args: any[]) => {
      const statement = (query as any)(sql, ...args)
      if (sql.startsWith('INSERT OR REPLACE INTO managed_authorizations') && authorizationWriteFails) return { run() { throw Object.assign(new Error('database or disk is full'), {code:'SQLITE_FULL'}) } }
      if (!sql.startsWith('INSERT OR REPLACE INTO managed_setup')) return statement
      return { run(value: string) {
        if (errorWriteFails && JSON.parse(value).status === 'error') throw new Error('SQLITE_FULL: database or disk is full')
        return statement.run(value)
      } }
    }
    const auth = await fetch(url + '/api/v1/session', { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: server.issueNonce() }) })
    cookie = auth.headers.get('set-cookie')!.split(';')[0]; csrf = (await auth.json() as any).csrf
    await call('/setup/scan', {}); await until(() => json('/setup'), s => s.status === 'complete')
  }
  await reopen()
  return { root, recipe, fixture, call, json, reopen, closeServer: () => server.close(), get transfers() { return transfers }, get ranges() { return ranges }, get installs() { return installs },
    setDisk(n: number) { available = n }, setBroken(v: boolean) { broken = v }, setSlow(v: boolean) { slow = v },
    failInstall(code: string | null) { installFailure = code },
    failErrorWrites(value: boolean) { errorWriteFails = value },
    failAuthorizationWrites(value: boolean) { authorizationWriteFails = value },
    async discoverExisting() { existingAvailable = true; await call('/setup/scan', {}); await until(() => json('/setup'), s => s.status === 'complete') },
    plan: async () => (await call('/setup/managed/plan', {})).json() as any,
    start: (revision: string) => call('/setup/managed/prepare', { revision, acceptInstallation: true, acceptLicense: true }),
    async close() { await server.close(); fixture.stop(); origin.stop(true); await rm(root, { recursive: true, force: true }) } }
}
test('managed: consent, stale plan, disk recheck, verified install, explicit creation and persistence', async () => {
  const c = await context()
  try {
    let plan = await c.plan()
    expect(plan.canPrepare).toBe(true); expect(c.transfers).toBe(0)
    expect((await c.call('/setup/managed/prepare', { revision: plan.revision, acceptInstallation: false, acceptLicense: true })).status).toBe(400)
    c.setDisk(1); expect((await c.start(plan.revision)).status).toBe(409); expect(c.transfers).toBe(0)
    c.setDisk(100 * 1024 ** 3)
    plan = await c.plan()
    await c.call('/settings', { modelsDirectory: join(c.root, 'other-models') }, 'PATCH')
    expect((await c.start(plan.revision)).status).toBe(409)
    plan = await c.plan(); expect((await c.start(plan.revision)).status).toBe(202)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
    expect(c.installs).toBe(1); expect(c.fixture.submissions).toHaveLength(0)
    const job: any = await (await c.call('/jobs', { requestId: crypto.randomUUID(), prompt: 'Explicit fixture image', format: 'square' })).json()
    await until(() => c.json(`/jobs/${job.id}`), s => s.status === 'completed')
    await c.closeServer(); await c.reopen()
    expect((await c.json('/setup/managed')).status).toBe('ready')
    expect((await c.json('/jobs')).total).toBe(1)
  } finally { await c.close() }
}, 30000)

test('managed: an existing engine requires an explicit separate choice and that choice invalidates the old plan', async () => {
  const c = await context()
  try {
    const external = join(c.root, 'external'); await mkdir(external); await writeFile(join(external, 'keep.txt'), 'preserve external environment')
    await c.discoverExisting()
    expect((await c.plan()).canPrepare).toBe(false)
    const separate: any = await (await c.call('/setup/managed/plan', { allowSeparateInstallation: true })).json()
    expect(separate.canPrepare).toBe(true); expect(separate.separateInstallation).toBe(true)
    await c.call('/setup/managed/plan', { allowSeparateInstallation: false })
    expect((await c.start(separate.revision)).status).toBe(409)
    const reviewed: any = await (await c.call('/setup/managed/plan', { allowSeparateInstallation: true })).json()
    await c.start(reviewed.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
    expect(await Bun.file(join(external, 'keep.txt')).text()).toBe('preserve external environment')
    expect((await c.json('/settings')).engineBinding.directory.startsWith(reviewed.directory)).toBe(true)
    expect(c.fixture.submissions).toHaveLength(0)
  } finally { await c.close() }
}, 30000)

test('managed: full metadata disk keeps the runtime error visible and recovers persisted active state as paused', async () => {
  const c = await context()
  try {
    c.failInstall('ENOSPC'); c.failErrorWrites(true)
    const plan = await c.plan(); await c.start(plan.revision)
    expect((await until(() => c.json('/setup/managed'), s => s.status === 'error')).message).toContain('Se agotó el espacio')
    await c.closeServer(); await c.reopen()
    expect((await c.json('/setup/managed')).status).toBe('paused')
    expect((await c.start(plan.revision)).status).toBe(409)
    c.failInstall(null); c.failErrorWrites(false)
    const resumed = await c.plan(); expect(resumed.remainingBytes).toBe(0)
    await c.start(resumed.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
  } finally { await c.close() }
}, 30000)
test('managed: resumable bytes, changed destination needs consent and custom location survives reopen', async () => {
  const c = await context()
  try {
    const first = await c.plan()
    expect((await c.call('/setup/managed/plan', { directory: 'relative' })).status).toBe(400)
    const custom = join(c.root, 'another volume')
    await c.call('/settings', { modelsDirectory: join(c.root, 'custom-models') }, 'PATCH')
    c.setDisk(2.25 * 1024 ** 3)
    expect((await c.plan()).canPrepare).toBe(false)
    c.setDisk(100 * 1024 ** 3)
    const plan: any = await (await c.call('/setup/managed/plan', { directory: custom })).json()
    expect(plan.directory).toBe(join(custom, 'Veltria-managed', c.recipe.id))
    expect((await c.start(first.revision)).status).toBe(409)
    const downloads = join(plan.directory, 'downloads'); await mkdir(downloads, { recursive: true })
    await writeFile(join(downloads, c.recipe.python.filename + '.part'), Buffer.alloc(8192, 23))
    const continued = await c.plan()
    expect(continued.remainingBytes).toBe(plan.totalBytes - 8192)
    await c.start(continued.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
    expect(c.ranges).toBe(1)
    await c.closeServer(); await c.reopen()
    expect((await c.plan()).directory).toBe(plan.directory)
  } finally { await c.close() }
}, 30000)
test('managed: bad hash never executes installer, retry preserves files and pause survives restart', async () => {
  const c = await context()
  try {
    c.setBroken(true); let plan = await c.plan(); await c.start(plan.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'error')
    expect(c.installs).toBe(0)
    c.setBroken(false); c.setSlow(true); plan = await c.plan(); await c.start(plan.revision)
    expect((await c.call('/settings', { modelsDirectory: join(c.root, 'forbidden-during-install') }, 'PATCH')).status).toBe(409)
    await c.call('/setup/managed/pause', {})
    expect((await c.json('/setup/managed')).status).toBe('paused')
    await c.closeServer(); await c.reopen(); expect((await c.json('/setup/managed')).status).toBe('paused')
    c.setSlow(false); plan = await c.plan(); await c.start(plan.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
    expect(c.installs).toBe(1)
  } finally { await c.close() }
}, 30000)

for (const code of ['ENOSPC', 'EACCES', 'EPERM', 'EDQUOT', 'EROFS']) test(`managed: ${code} during installation preserves verified files and requires review after reopen`, async () => {
  const c = await context()
  try {
    c.failInstall(code)
    const plan = await c.plan(); await c.start(plan.revision)
    const failed = await until(() => c.json('/setup/managed'), s => s.status === 'error')
    expect(failed.storageIssue.code).toBe(({ ENOSPC: 'disk-full', EACCES: 'permission-denied', EPERM: 'permission-denied', EDQUOT: 'quota', EROFS: 'read-only' } as Record<string,string>)[code])
    expect(failed.storageIssue.target).toBe('environment')
    expect(await Bun.file(join(plan.directory, 'interrupted-install')).text()).toBe('partial installation')
    const transfers = c.transfers
    await c.closeServer(); await c.reopen()
    expect((await c.json('/setup/managed')).status).toBe('error')
    expect((await c.start(plan.revision)).status).toBe(409)
    expect(c.transfers).toBe(transfers)
    c.failInstall(null)
    const resumed = await c.plan(); expect(resumed.remainingBytes).toBe(0)
    await c.start(resumed.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
    expect(c.transfers).toBe(transfers)
    expect(c.fixture.submissions).toHaveLength(0)
  } finally { await c.close() }
}, 30000)

test('managed: a low-space warning allows consent but an insufficient combined budget blocks without downloads', async () => {
  const c = await context()
  try {
    const plan = await c.plan(), required = plan.requiredBytes + plan.preparation.requiredBytes
    c.setDisk(required + 1)
    const warning = await c.plan()
    expect(warning.canPrepare).toBe(true); expect(warning.storageIssues.some((issue: any) => issue.code === 'low-space')).toBe(true)
    c.setDisk(required - 1)
    const blocked = await c.plan()
    expect(blocked.canPrepare).toBe(false); expect(blocked.storageIssues.some((issue: any) => issue.code === 'disk-full')).toBe(true)
    expect((await c.start(warning.revision)).status).toBe(409); expect(c.transfers).toBe(0)
  } finally { await c.close() }
})

test('managed: denied model folder blocks preflight, preserves its data and recovers after choosing another folder', async () => {
  if (process.platform === 'win32' || process.getuid?.() === 0) return
  const c = await context(), denied = join(c.root,'denied-models')
  try {
    await mkdir(denied); await writeFile(join(denied,'keep'),'original'); await chmod(denied,0o500)
    await c.call('/settings',{ modelsDirectory: denied },'PATCH')
    const blocked = await c.plan()
    expect(blocked.canPrepare).toBe(false)
    expect(blocked.storageIssues.some((issue: any) => issue.code === 'permission-denied' && issue.target === 'models')).toBe(true)
    expect((await c.start(blocked.revision)).status).toBe(409); expect(c.transfers).toBe(0)
    await c.call('/settings',{ modelsDirectory: join(c.root,'writable-models') },'PATCH')
    const changed = await c.plan(); expect(changed.canPrepare).toBe(true)
    expect((await c.start(blocked.revision)).status).toBe(409)
    await c.start(changed.revision); await until(() => c.json('/setup/managed'), s => s.status === 'ready')
    expect(await Bun.file(join(denied,'keep')).text()).toBe('original')
  } finally { await chmod(denied,0o700); await c.close() }
},30000)

test('managed: permissions lost on models during environment download identify the models folder and recover', async () => {
  if (process.platform === 'win32' || process.getuid?.() === 0) return
  const c = await context(), models = join(c.root,'models-during-install')
  try {
    await mkdir(models); await c.call('/settings',{modelsDirectory:models},'PATCH')
    c.setSlow(true)
    const plan = await c.plan(); await c.start(plan.revision)
    await chmod(models,0o500)
    const failed = await until(() => c.json('/setup/managed'), s => s.status === 'error')
    expect(failed.storageIssue.target).toBe('models'); expect(failed.storageIssue.code).toBe('permission-denied')
    const transfers = c.transfers; await chmod(models,0o700); c.setSlow(false)
    const next = await c.plan(); await c.start(next.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
    expect(c.transfers).toBe(transfers)
  } finally { await chmod(models,0o700); await c.close() }
},30000)

test('managed: metadata disk filling after review blocks authorization before network and allows reviewed recovery', async () => {
  const c = await context()
  try {
    const plan = await c.plan(); c.failAuthorizationWrites(true)
    expect((await c.start(plan.revision)).status).toBe(409)
    const failed = await c.json('/setup/managed')
    expect(failed.status).toBe('error'); expect(failed.storageIssue.target).toBe('data'); expect(failed.storageIssue.code).toBe('disk-full')
    expect(c.transfers).toBe(0)
    c.failAuthorizationWrites(false)
    const next = await c.plan(); await c.start(next.revision)
    await until(() => c.json('/setup/managed'), s => s.status === 'ready')
  } finally { await c.close() }
},30000)
