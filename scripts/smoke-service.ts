import { mkdtemp, rm, cp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { launchService } from './supervisor'
import { engineSchema, hardwareSchema, healthSchema, resourcesSchema, videoStateSchema, catalogSchema, setupStateSchema } from '@veltria/contracts'

const temp = await mkdtemp(join(tmpdir(), 'Veltria integration with spaces '))
let fixtureMode = 'valid', checks = 0
const fixture = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  const path = new URL(request.url).pathname
  if (fixtureMode === 'redirect') return Response.redirect('http://example.com', 302)
  if (fixtureMode === 'invalid') return Response.json({ wrong: true })
  if (fixtureMode === 'http') return new Response('not ready', { status: 503 })
  if (fixtureMode === 'timeout') return new Promise<Response>(resolve => setTimeout(() => resolve(Response.json({})), 6000))
  return Response.json(path === '/system_stats' ? { system: { comfyui_version: 'fixture-only' }, devices: [{ name: 'Test device; no GPU test' }] } : { CheckpointLoaderSimple: { input: { required: { ckpt_name: [['fixture.safetensors']] } } } })
} })
const localExe = process.platform === 'win32' ? 'veltria-service.exe' : 'veltria-service'
try {
  const ui = join(temp, 'UI resources'); await cp(resolve('apps/ui/dist'), ui, { recursive: true })
  const binary = join(temp, localExe); await cp(resolve('build/service', localExe), binary)
  for (const mode of ['source', 'compiled']) {
    const config = { executable: mode === 'source' ? process.execPath : binary, args: mode === 'source' ? [resolve('apps/local-service/src/index.ts')] : [], uiDir: ui, dataDir: join(temp, `data ${mode}`) }
    const diagnostics = Bun.spawn([config.executable, ...config.args, '--check-storage'], { stdout: 'pipe', stderr: 'pipe' })
    const diagnosticOutput = await new Response(diagnostics.stdout).text()
    assert.equal(await diagnostics.exited, 0); assert.equal(JSON.parse(diagnosticOutput).rollback, true); checks++
    let service = await launchService(config)
    try {
      const origin = service.ready.origin
      const res = (path: string, init?: RequestInit) => fetch(`${origin}/api/v1${path}`, { ...init, redirect: 'manual' })
      assert.equal((await res('/settings')).status, 401); checks++
      assert.equal((await res('/resources')).status, 401); checks++
      assert.equal((await res('/catalog')).status, 401); checks++
      assert.equal((await res('/setup')).status, 401); checks++
      assert.equal((await res('/video/jobs')).status, 401); checks++
      assert.equal((await res('/identity', { headers: { host: 'evil.example' } })).status, 403); checks++
      assert.equal((await res('/identity', { headers: { origin: 'https://evil.example' } })).status, 403); checks++
      const authorize = async (nonce: string) => {
        const response = await res('/session', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce }) })
        assert.equal(response.status, 200)
        const cookieHeader = response.headers.get('set-cookie')!
        assert.match(cookieHeader, /HttpOnly/i); assert.match(cookieHeader, /SameSite=Strict/i)
        return { cookie: cookieHeader.split(';')[0], csrf: (await response.json() as any).csrf as string }
      }
      const session = await authorize(service.ready.nonce); checks++
      assert.equal((await res('/session', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: service.ready.nonce }) })).status, 401); checks++
      const headers = { cookie: session.cookie, origin, 'x-veltria-csrf': session.csrf, 'content-type': 'application/json' }
      assert.equal((await res('/settings', { method: 'PATCH', headers: { cookie: session.cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify({ theme: 'dark' }) })).status, 403); checks++
      assert.equal((await res('/settings', { method: 'PATCH', headers, body: JSON.stringify({ theme: 'invalid' }) })).status, 400); checks++
      assert.equal((await res('/settings', { method: 'PATCH', headers, body: JSON.stringify({ locale: 'fr' }) })).status, 400); checks++
      assert.equal((await res('/settings', { method: 'PATCH', headers, body: JSON.stringify({ engineUrl: 'http://192.168.1.2:8188' }) })).status, 400); checks++
      assert.equal((await res('/settings', { method: 'PATCH', headers, body: JSON.stringify({ unknown: true }) })).status, 400); checks++
      assert.equal((await res('/settings', { method: 'PATCH', headers, body: '{bad' })).status, 400); checks++
      assert.equal((await res('/settings', { method: 'PATCH', headers, body: JSON.stringify({ huge: 'x'.repeat(50000) }) })).status, 413); checks++
      const health = healthSchema.parse(await (await res('/health', { headers })).json())
      assert.equal(health.capabilities.generation, true); assert.equal(health.capabilities.video, true); assert.match(health.runtime, /Bun/); checks++
      const setup = setupStateSchema.parse(await (await res('/setup', { headers })).json())
      assert.equal(setup.status, 'idle'); checks++
      assert.equal((await res('/setup/scan', { method: 'POST', headers, body: JSON.stringify({ directory: 'relative/path' }) })).status, 400); checks++
      assert.equal((await res('/setup/prepare', { method: 'POST', headers, body: JSON.stringify({ revision: 'a'.repeat(64), acceptLicense: true, acceptReuse: false }) })).status, 400); checks++
      const catalog = catalogSchema.parse(await (await res('/catalog', { headers })).json())
      assert.equal(catalog.models.length, 2); assert.equal(catalog.configurations.length, 6); checks++
      const exportedConfiguration = await res(`/catalog/configurations/${catalog.selectedConfigurationId}`, { headers })
      assert.match(exportedConfiguration.headers.get('content-disposition')!, /attachment/); assert.equal((await exportedConfiguration.json() as any).kind, 'veltria-image-configuration'); checks++
      const video = videoStateSchema.parse(await (await res('/video', { headers })).json())
      assert.equal(video.canCreate, false); assert.equal(video.experimental, true); checks++
      assert.equal((await res('/video/prepare', { method: 'POST', headers, body: JSON.stringify({ revision: 'a'.repeat(64), acceptLicense: true, acceptExperimental: false }) })).status, 400); checks++
      const hardware = hardwareSchema.parse(await (await res('/hardware', { headers })).json())
      assert.ok(hardware.cpu.logicalCores > 0); assert.ok(hardware.ram.total! > 0); checks++
      const resources = resourcesSchema.parse(await (await res('/resources', { headers })).json())
      assert.ok(resources.ram.total! > 0); assert.ok(resources.disk.available! > 0); checks++
      const staticResponse = await fetch(origin)
      assert.match(await staticResponse.text(), /<title>Veltria<\/title>/); assert.match(staticResponse.headers.get('content-security-policy')!, /script-src 'self'/); checks++
      assert.equal((await res('/anything')).status, 401); checks++
      const streamAbort = new AbortController()
      const stream = await res('/events', { headers, signal: streamAbort.signal })
      assert.match(stream.headers.get('content-type')!, /text\/event-stream/)
      const reader = stream.body!.getReader()
      assert.match(new TextDecoder().decode((await reader.read()).value), /connected/); checks++
      const patch = async (body: unknown) => res('/settings', { method: 'PATCH', headers, body: JSON.stringify(body) })
      await patch({ theme: 'dark', locale: 'en' })
      assert.match(new TextDecoder().decode((await reader.read()).value), /settings/); checks++
      await reader.cancel(); streamAbort.abort()
      const second = await launchService(config)
      assert.equal(second.owned, false); assert.equal(second.ready.instanceId, service.ready.instanceId)
      const session2 = await authorize(second.ready.nonce)
      assert.equal((await (await res('/settings', { headers: { cookie: session2.cookie } })).json() as any).theme, 'dark')
      await second.stop(); assert.equal((await res('/identity')).status, 200); checks++
      await patch({ engineUrl: `http://127.0.0.1:${fixture.port}` })
      for (const [mode, expected] of [['valid', 'ready'], ['invalid', 'error'], ['http', 'error'], ['redirect', 'unavailable'], ['timeout', 'unavailable']]) {
        fixtureMode = mode
        const response = await res('/engine/check', { method: 'POST', headers, body: '{}' })
        const engine = engineSchema.parse(await response.json())
        assert.equal(engine.status, expected, `${mode}: ${engine.message}`)
        if (mode === 'valid') { assert.equal(engine.models.length, 1); assert.equal(engine.version, 'fixture-only') }
        checks++
      }
      await patch({ engineUrl: 'http://127.0.0.1:1' })
      assert.equal(engineSchema.parse(await (await res('/engine/check', { method: 'POST', headers, body: '{}' })).json()).status, 'unavailable'); checks++
      // Shutdown must finish with a live SSE consumer; it cannot await a never-ending stream.
      const openStream = await res('/events', { headers })
      await service.stop(); assert.equal(await openStream.body!.getReader().read().then(() => true), true); checks++
      service = await launchService(config)
      const restored = await fetch(`${service.ready.origin}/api/v1/session`, { method: 'POST', headers: { origin: service.ready.origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: service.ready.nonce }) })
      const restoredSettings = (await restored.json() as any).settings
      assert.equal(restoredSettings.theme, 'dark'); assert.equal(restoredSettings.locale, 'en'); checks++
      service.child!.kill('SIGKILL')
      await new Promise(resolve => service.child!.once('exit', resolve))
      service = await launchService(config)
      assert.ok(service.owned); checks++
      console.log(`${mode}: HTTP real, estáticos, sesión/CSRF, SSE, SQLite, hardware y fallos controlados OK`)
    } finally { await service.stop() }
  }
  await assert.rejects(launchService({ executable: join(temp, 'missing-helper'), uiDir: ui, dataDir: join(temp, 'missing data') }))
  checks++
  console.log(`${checks} comprobaciones de integración superadas. ComfyUI de prueba es una fixture, sin inferencia.`)
} finally { fixture.stop(true); await rm(temp, { recursive: true, force: true }) }
