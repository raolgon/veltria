// Test-only streamed bytes and delayed install; never included in the product build.
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createServer } from '../apps/local-service/src/server'
import { CreationFixture, fixtureHardware } from '../tests/creation-fixture'
import type { ManagedRecipe } from '../apps/local-service/src/managed'
const dataDir = process.env.VELTRIA_TEST_DIR
if (!dataDir) throw new Error('Temporary fixture directory required')
const fixture = new CreationFixture(); fixture.downloadDelay = 40
const bytes = Buffer.alloc(64 * 1024, 31), hash = createHash('sha256').update(bytes).digest('hex')
const files = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() {
  let offset = 0, timer: ReturnType<typeof setInterval>
  return new Response(new ReadableStream<Uint8Array>({ start(controller) {
    timer = setInterval(() => { if (offset === bytes.length) { clearInterval(timer); controller.close(); return }; controller.enqueue(bytes.subarray(offset, offset + 1024)); offset += 1024 }, 30)
  }, cancel() { clearInterval(timer) } }), { headers: { 'content-length': String(bytes.length) } })
} })
const artifact = (filename: string) => ({ filename, url: `http://127.0.0.1:${files.port}/${filename}`, bytes: bytes.length, sha256: hash })
const recipe: ManagedRecipe = { id: 'progress-fixture', platform: process.platform, arch: 'x64', comfy: artifact('comfy.tar.gz'), python: artifact('python.tar.gz'), uv: artifact('uv.tar.gz'), wheels: [], requirements: '', licenses: ['Fixture only; not executable packages'] }
const server = await createServer({ dataDir, uiDir: resolve('apps/ui/dist'), controlToken: 'a'.repeat(64), instanceId: crypto.randomUUID(),
  creation: { profile: fixture.profile, hardware: async () => fixtureHardware, engine: fixture.engine, allowLocalFixture: true },
  setup: { discover: async () => ({ installations: [], notes: [] }) },
  managed: { recipe, allowLocalFixture: true, install: async (directory, signal) => {
    await Bun.sleep(2000); signal.throwIfAborted()
    const binding = { directory: join(directory, 'fixture-engine'), python: join(directory, 'fixture-python') }
    await mkdir(binding.directory, { recursive: true }); return binding
  } } })
const origin = await server.listen()
console.log(JSON.stringify({ origin, nonce: server.issueNonce(), fixture: true }))
async function stop() { await server.close(); fixture.stop(); files.stop(true); process.exit(0) }
process.on('SIGTERM', stop); process.on('SIGINT', stop)
