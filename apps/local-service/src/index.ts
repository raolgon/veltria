import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { z } from 'zod'
import { createServer } from './server'
import { dataDirectory } from '../../../scripts/paths'
import { protocol, development } from '@veltria/contracts'
import { checkStorage } from '../../../packages/adapters/src/storage-check'

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--check-storage')) { console.log(JSON.stringify(await checkStorage())); return }
  const value = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
  const dataDir = value('--data-dir') || dataDirectory(), uiDir = value('--ui-dir')
  if (!uiDir || !isAbsolute(uiDir) || !isAbsolute(dataDir)) throw new Error('Se requieren rutas absolutas a UI y datos.')
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  // Private pipe, bounded; no launch secrets in command arguments or environment.
  let input = ''
  const inputTimer = setTimeout(() => { console.error('El supervisor no envió el inicio a tiempo.'); process.exit(1) }, 10_000)
  for await (const chunk of process.stdin) {
    input += chunk.toString()
    if (input.length > 4096) throw new Error('Inicio demasiado grande')
  }
  clearTimeout(inputTimer)
  const { controlToken } = z.object({ controlToken: z.string().length(64) }).strict().parse(JSON.parse(input))
  const lockDir = join(dataDir, '.service-lock')
  await mkdir(lockDir, { mode: 0o700 }) // exclusive owner; never share SQLite between product services
  const instanceId = crypto.randomUUID()
  const descriptor = { pid: process.pid, platform: process.platform, name: 'veltria', protocol, instanceId, origin: '', controlToken }
  const descriptorPath = join(lockDir, 'instance.json')
  await writeFile(descriptorPath, JSON.stringify(descriptor), { mode: 0o600 })
  let server: Awaited<ReturnType<typeof createServer>> | undefined, stopped = false
  const cleanup = async () => {
    try {
      const current = JSON.parse(await readFile(descriptorPath, 'utf8'))
      if (current.instanceId === instanceId) await rm(lockDir, { recursive: true })
    } catch { /* no lock to release */ }
  }
  const shutdown = async () => {
    if (stopped) return
    stopped = true
    const force = setTimeout(() => process.exit(1), 15000); force.unref()
    await server?.close()
    await cleanup()
    clearTimeout(force)
    process.exit(0)
  }
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown)
  try {
    const devOrigin = value('--dev-origin')
    if (devOrigin && devOrigin !== development.uiOrigin) throw new Error('Origen de desarrollo no admitido')
    server = await createServer({ dataDir, uiDir, controlToken, instanceId, devOrigin, onShutdown: shutdown })
    const port = Number(value('--port') || 0)
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Puerto no válido')
    descriptor.origin = await server.listen(port)
    await writeFile(descriptorPath, JSON.stringify(descriptor), { mode: 0o600 })
    process.stdout.write(JSON.stringify({ name: 'veltria', protocol, instanceId, origin: descriptor.origin, nonce: server.issueNonce() }) + '\n')
  } catch (cause) { await server?.close(); await cleanup(); throw cause }
}
main().catch(cause => { console.error('No se pudo iniciar Veltria:', cause instanceof Error ? cause.message : 'error'); process.exit(1) })
