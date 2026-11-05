// Opt-in real-provider check. Not imported by the app or the default test suite.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, stat, writeFile, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { imageModels } from '@veltria/core'
import { downloadProfileFile, fileBytes, hashFile } from '../packages/adapters/src/profile-download'
const [id, reference] = process.argv.slice(2)
const profile = imageModels.find(item => item.id === id)
assert.ok(profile && reference, 'Usage: bun scripts/validate-model-transfer.ts dreamshaper-8 /absolute/reference.safetensors')
const existing = resolve(reference)
assert.equal((await stat(existing)).size, profile.bytes)
assert.equal(await hashFile(existing), profile.sha256, 'The reference checkpoint must be the pinned file')
const directory = await mkdtemp(join(tmpdir(), 'Veltria real model transfer ')), destination = join(directory, profile.filename)
await mkdir(directory, { recursive: true })
const record: Record<string, unknown> = { kind: 'real-provider-prefix-transfer', platform: process.platform, runtime: `Bun ${Bun.version}`, model: profile.id, source: profile.source, expectedModelSha256: profile.sha256, reference: existing, directory, startedAt: new Date().toISOString(), events: [] }
async function transferUntil(target: number) {
  const controller = new AbortController(), events: { received: number; restart: boolean }[] = []
  try {
    await downloadProfileFile(profile!, destination, controller.signal, (received, restart) => {
      events.push({ received, restart })
      if (restart || received >= target) controller.abort()
    })
    throw new Error('The bounded transfer unexpectedly completed the entire checkpoint')
  } catch (error) { if (!controller.signal.aborted) throw error }
  assert.ok(!events.some(event => event.restart), 'Provider must preserve a resumed partial file')
  return { bytes: await fileBytes(destination + '.part'), events }
}
try {
  const first = await transferUntil(2 * 1024 ** 2)
  assert.ok(first.bytes >= 2 * 1024 ** 2 && first.bytes < 16 * 1024 ** 2)
  const second = await transferUntil(first.bytes + 2 * 1024 ** 2)
  assert.ok(second.bytes > first.bytes && second.bytes < 32 * 1024 ** 2)
  assert.equal(second.events[0].received, first.bytes, 'The second request continues at the saved offset')
  const expected = createHash('sha256')
  for await (const chunk of createReadStream(existing, { start: 0, end: second.bytes - 1 })) expected.update(chunk)
  const prefixHash = await hashFile(destination + '.part')
  assert.equal(prefixHash, expected.digest('hex'), 'The streamed and resumed prefix matches the verified full checkpoint')
  Object.assign(record, { firstBytes: first.bytes, resumedBytes: second.bytes, prefixSha256: prefixHash, result: 'passed', finishedAt: new Date().toISOString() })
  await unlink(destination + '.part')
  record.temporaryPartialRemoved = true
  console.log(`REAL PROVIDER PREFIX PASS: ${process.platform}, ${first.bytes} -> ${second.bytes} bytes, resumed prefix verified; full fresh download and inference are not claimed.`)
} catch (error) { record.result = 'failed'; record.error = error instanceof Error ? error.message : String(error); process.exitCode = 1 }
finally { await writeFile(join(directory, 'validated-transfer.json'), JSON.stringify(record, null, 2)); console.log(`VALIDATION DATA: ${directory}`) }
