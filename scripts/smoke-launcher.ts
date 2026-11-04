import { mkdtemp, rm, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
const directory = await mkdtemp(join(tmpdir(), 'Veltria launcher with spaces '))
const executable = resolve('build/browser/0.2.0', process.platform === 'win32' ? 'veltria-web.exe' : 'veltria-web')
const child = Bun.spawn([executable], { cwd: directory, env: { ...process.env, VELTRIA_DATA_DIR: join(directory, 'data with spaces') }, stdout: 'pipe', stderr: 'pipe' })
try {
  const reader = child.stdout.getReader()
  let output = '', url: string | undefined
  for (let i = 0; i < 10 && !url; i++) {
    const result = await reader.read()
    if (result.done) break
    output += new TextDecoder().decode(result.value)
    url = output.match(/http:\/\/127\.0\.0\.1:\d+\/#launch=[a-f0-9]{64}/)?.[0]
  }
  assert.ok(url, 'El lanzador no imprimió una URL autorizada')
  const parsed = new URL(url), nonce = new URLSearchParams(parsed.hash.slice(1)).get('launch')
  assert.equal((await fetch(parsed.origin)).status, 200)
  const auth = await fetch(`${parsed.origin}/api/v1/session`, { method: 'POST', headers: { origin: parsed.origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce }) })
  assert.equal(auth.status, 200)
  assert.equal((await auth.json() as any).settings.theme, 'system')
  child.kill('SIGTERM')
  assert.equal(await child.exited, 0)
  await assert.rejects(access(join(directory, 'data with spaces', '.service-lock')))
  console.log('Lanzador web compilado: UI/auxiliar relativos al ejecutable, sesión y cierre OK desde cwd y datos con espacios.')
} finally {
  if (child.exitCode === null) child.kill('SIGKILL')
  await rm(directory, { recursive: true, force: true })
}
