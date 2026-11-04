import { resolve } from 'node:path'
import { launchService } from './supervisor'
import { dataDirectory } from './paths'
import { development } from '@veltria/contracts'
if (Bun.version !== '1.4.4') throw new Error('Usa Bun 1.4.4.')
const service = await launchService({ executable: process.execPath, args: [resolve('apps/local-service/src/index.ts')], uiDir: resolve('apps/ui/dist'), dataDir: dataDirectory(), dev: true })
if (service.ready.origin !== development.serviceOrigin) throw new Error('Cierra el servicio de producción antes de iniciar el modo desarrollo con proxy.')
const vite = Bun.spawn([process.execPath, resolve('apps/ui/node_modules/vite/bin/vite.js'), '--config', 'apps/ui/vite.config.ts'], { stdout: 'pipe', stderr: 'inherit' })
let stopping = false
async function stop() { if (stopping) return; stopping = true; vite.kill(); await service.stop(); process.exit(0) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
// Wait for this exact Vite child's readiness, not an HTTP response from an unrelated listener.
void (async () => {
  let buffer = '', announced = false
  for await (const chunk of vite.stdout) {
    const text = new TextDecoder().decode(chunk); process.stdout.write(text)
    buffer = (buffer + text).slice(-4096)
    if (!announced && buffer.includes(development.uiOrigin)) {
      announced = true
      console.log(`Desarrollo: ${development.uiOrigin}/#launch=${service.ready.nonce}`)
    }
  }
})()
await vite.exited; await stop()
