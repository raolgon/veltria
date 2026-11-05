import { test, expect } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile, readFile, access, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverEngines } from '../packages/adapters/src/engine-discovery'
import { createServer } from '../apps/local-service/src/server'
import { CreationFixture, fixtureHardware } from './creation-fixture'
async function until<T>(work: () => Promise<T>, predicate: (value: T) => boolean, ms = 10000): Promise<T> {
  const end = Date.now() + ms
  do { const value = await work(); if (predicate(value)) return value; await Bun.sleep(20) } while (Date.now() < end)
  throw new Error('Setup state timeout')
}
async function engine(root: string, layout = '.venv/bin/python', safe = true) {
  await mkdir(join(root, 'comfy'), { recursive: true })
  await writeFile(join(root, 'main.py'), '# fixture, not executed')
  await writeFile(join(root, 'folder_paths.py'), '# fixture')
  await writeFile(join(root, 'comfy/cli_args.py'), '--extra-model-paths-config --user-directory --disable-all-custom-nodes --database-url')
  await writeFile(join(root, 'server.py'), safe ? '/api/jobs/{job_id}/cancel interrupt_if_running' : '# unsupported')
  const python = join(root, layout); await mkdir(join(python, '..'), { recursive: true })
  await writeFile(python, python.endsWith('.exe') ? 'MZfixture' : '#!/bin/sh\ntouch "' + join(root, 'must-not-execute') + '"\n', { mode: 0o700 })
  return { directory: root, python }
}
test('búsqueda Linux: venv local, deduplicación de enlaces y sólo lectura sin ejecutar Python', async () => {
  const root = await mkdtemp(join(tmpdir(), 'Veltria discovery linux '))
  try {
    const binding = await engine(join(root, 'ComfyUI'))
    await symlink(binding.directory, join(root, 'comfyui'), 'dir')
    const result = await discoverEngines(null, undefined, { platform: 'linux', roots: [root], home: root, desktopConfig: join(root, 'missing.json') })
    expect(result.installations).toHaveLength(1)
    expect(result.installations[0]).toMatchObject({ available: true, python: binding.python })
    await expect(access(join(binding.directory, 'must-not-execute'))).rejects.toThrow()
    expect(await readFile(join(binding.directory, 'main.py'), 'utf8')).toBe('# fixture, not executed')
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('búsqueda Windows: portable y Pinokio en otra unidad, capacidades y entornos ausentes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'Veltria discovery portable '))
  try {
    const portable = await engine(join(root, 'ComfyUI_windows_portable', 'ComfyUI'), '../python_embeded/python.exe')
    const pinokio = await engine(join(root, 'pinokio/api/minimax-h3.git/app'), 'env/Scripts/python.exe')
    await engine(join(root, 'pinokio/api/old.git/app'), 'env/Scripts/python.exe', false)
    const missing = await engine(join(root, 'pinokio/api/missing-python.git/app'), 'env/Scripts/python.exe'); await rm(missing.python)
    const result = await discoverEngines(null, undefined, { platform: 'win32', home: root, roots: [], drives: [root], desktopConfig: join(root, 'none.json') })
    expect(result.installations.find(item => item.directory === portable.directory)).toMatchObject({ available: true, python: portable.python })
    expect(result.installations.find(item => item.directory === pinokio.directory)).toMatchObject({ available: true, kind: 'pinokio' })
    expect(result.installations.filter(item => !item.available)).toHaveLength(2)
    expect(result.installations.find(item => item.directory === missing.directory)?.python).toBeNull()
    const explicit = await discoverEngines(portable, join(root, 'pinokio'), { platform: 'win32' })
    expect(explicit.installations.some(item => item.directory === portable.directory)).toBe(false)
    expect(explicit.installations.some(item => item.directory === pinokio.directory && item.available)).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('entorno del servicio: no propone Python de Windows para Linux y permite elegir una carpeta sin entorno', async () => {
  const root = await mkdtemp(join(tmpdir(), 'Veltria discovery platform '))
  try {
    const binding = await engine(join(root, 'ComfyUI'), 'env/Scripts/python.exe')
    const result = await discoverEngines(null, binding.directory, { platform: 'linux' })
    expect(result.installations[0]).toMatchObject({ available: false, python: null })
    expect((await discoverEngines(null, join(root, 'absent'), { platform: 'linux' })).installations).toHaveLength(0)
  } finally { await rm(root, { recursive: true, force: true }) }
})
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'Veltria onboarding API ')), ui = join(root, 'ui')
  await mkdir(ui); await writeFile(join(ui, 'index.html'), '<title>fixture</title>')
  const fixture = new CreationFixture(), binding = await fixture.binding(root)
  const server = await createServer({ dataDir: root, uiDir: ui, controlToken: 'a'.repeat(64), instanceId: crypto.randomUUID(),
    creation: { profile: fixture.profile, hardware: async () => fixtureHardware, disk: async () => fixture.availableBytes, engine: fixture.engine, allowLocalFixture: true },
    setup: { discover: (linked, directory, signal) => discoverEngines(linked, directory || binding.directory, { signal }) } })
  const origin = await server.listen()
  const auth = await fetch(`${origin}/api/v1/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: server.issueNonce() }) })
  const cookie = auth.headers.get('set-cookie')!.split(';')[0], session: any = await auth.json()
  const call = (path: string, method = 'GET', value?: unknown) => fetch(origin + '/api/v1' + path, { method, headers: { origin, cookie, 'content-type': 'application/json', 'x-veltria-csrf': session.csrf }, body: value === undefined ? undefined : JSON.stringify(value) })
  const json = async (path: string) => (await call(path)).json() as any
  async function proposal() {
    await call('/setup/scan', 'POST', {})
    const scan = await until(() => json('/setup'), state => state.status === 'complete')
    const response = await call('/setup/plan', 'POST', { scanId: scan.scanId, installationId: scan.installations[0].id })
    const result: any = await response.json(); if (!response.ok) throw new Error(JSON.stringify({ result, scan })); return result
  }
  return { root, binding, fixture, server, origin, call, json, proposal, async close() { await server.close(); fixture.stop(); await rm(root, { recursive: true, force: true }) } }
}
test('preparación inicial: búsqueda/propuesta no mutan preferencias, consentimiento único y creación con entorno detectado', async () => {
  const ctx = await setup(); ctx.fixture.downloadDelay = 1
  try {
    expect((await fetch(`${ctx.origin}/api/v1/setup`)).status).toBe(401)
    expect((await ctx.call('/setup/scan', 'POST', { directory: 'relative/path' })).status).toBe(400)
    expect((await ctx.call('/setup/scan', 'POST', { python: '/arbitrary/executable' })).status).toBe(400)
    const plan = await ctx.proposal()
    expect(plan.preparation.canPrepare).toBe(true)
    expect(plan.installation.python).toBe(ctx.binding.python)
    expect((await ctx.json('/settings')).engineBinding).toBeNull()
    expect(ctx.fixture.downloads).toBe(0)
    expect((await ctx.call('/setup/prepare', 'POST', { revision: plan.revision, acceptLicense: false, acceptReuse: true })).status).toBe(400)
    expect((await ctx.call('/setup/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptReuse: false })).status).toBe(400)
    expect((await ctx.call('/setup/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptReuse: true })).status).toBe(202)
    await until(() => ctx.json('/creation'), state => state.canCreate)
    expect((await ctx.json('/settings')).engineBinding).toEqual(ctx.binding)
    expect(ctx.fixture.submissions).toHaveLength(0)
    const job: any = await (await ctx.call('/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'My unchanged idea', format: 'portrait' })).json()
    await until(() => ctx.json(`/jobs/${job.id}`), state => state.status === 'completed')
    expect(ctx.fixture.submissions[0].prompt['2'].inputs.text).toBe('My unchanged idea')
  } finally { await ctx.close() }
}, 15000)
test('propuesta obsoleta: rechaza cambios de ubicación, receta y archivos sin vincular ni descargar', async () => {
  const ctx = await setup()
  try {
    let plan = await ctx.proposal()
    await ctx.call('/settings', 'PATCH', { modelsDirectory: join(ctx.root, 'other') })
    expect((await ctx.call('/setup/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptReuse: true })).status).toBe(409)
    plan = await ctx.proposal()
    await ctx.call('/catalog/select', 'POST', { configurationId: ctx.fixture.profile.id + '-draft' })
    expect((await ctx.call('/setup/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptReuse: true })).status).toBe(409)
    plan = await ctx.proposal()
    await writeFile(join(ctx.binding.directory, 'main.py'), '# changed after review')
    expect((await ctx.call('/setup/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptReuse: true })).status).toBe(409)
    expect(ctx.fixture.downloads).toBe(0)
    expect((await ctx.json('/settings')).engineBinding).toBeNull()
  } finally { await ctx.close() }
})
test('sin espacio: bloquea antes de cambiar instalación o contactar el proveedor', async () => {
  const ctx = await setup(); ctx.fixture.availableBytes = 100
  try {
    const plan = await ctx.proposal()
    expect(plan.preparation.canPrepare).toBe(false)
    expect((await ctx.call('/setup/prepare', 'POST', { revision: plan.revision, acceptLicense: true, acceptReuse: true })).status).toBe(409)
    expect((await ctx.json('/settings')).engineBinding).toBeNull()
    expect(ctx.fixture.downloads).toBe(0)
  } finally { await ctx.close() }
})
