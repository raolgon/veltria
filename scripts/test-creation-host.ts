// Test-only composition root. This file is never imported or compiled by the product entrypoint.
import { resolve, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { protocol } from '@veltria/contracts'
import { createServer } from '../apps/local-service/src/server'
import { CreationFixture, fixtureHardware } from '../tests/creation-fixture'
import { discoverEngines } from '../packages/adapters/src/engine-discovery'
import { VideoFixture } from '../tests/video-fixture'
const dataDir = process.env.VELTRIA_TEST_DIR
if (!dataDir) throw new Error('VELTRIA_TEST_DIR temporal obligatorio')
await mkdir(dataDir, { recursive: true })
const fixture = new CreationFixture(), videoFixture = new VideoFixture()
const binding = await fixture.binding(dataDir)
const secondary = process.env.VELTRIA_TEST_ONBOARDING === '1' ? await fixture.binding(join(dataDir, 'another installation')) : null
const server = await createServer({ dataDir, uiDir: resolve('apps/ui/dist'), controlToken: 'a'.repeat(64), instanceId: crypto.randomUUID(), video: videoFixture.options, setup: { discover: async (linked, directory, signal) => { const result = await discoverEngines(linked, directory || binding.directory, { signal }); if (secondary && !directory) result.installations.push(...(await discoverEngines(null, secondary.directory, { signal })).installations); return result } }, creation: { profile: fixture.profile, hardware: async () => fixtureHardware, engine: fixture.engine, allowLocalFixture: true } })
if (process.env.VELTRIA_TEST_ONBOARDING !== '1') server.repository.update({ engineBinding: binding })
const origin = await server.listen()
await mkdir(join(dataDir, '.service-lock'))
await writeFile(join(dataDir, '.service-lock', 'instance.json'), JSON.stringify({ name: 'veltria', protocol, platform: process.platform, pid: process.pid, instanceId: (await server.app.inject({ method: 'GET', url: '/api/v1/identity', headers: { host: new URL(origin).host } })).json().instanceId, origin, controlToken: 'a'.repeat(64) }))
console.log(JSON.stringify({ origin, nonce: server.issueNonce(), fixture: true }))
async function stop() { await server.close(); fixture.stop(); videoFixture.stop(); process.exit(0) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
