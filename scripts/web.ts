import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { launchService } from './supervisor'
import { dataDirectory } from './paths'
const root = fileURLToPath(new URL('../', import.meta.url))
const executable = join(root, 'build/service', process.platform === 'win32' ? 'veltria-service.exe' : 'veltria-service')
const service = await launchService({ executable, uiDir: resolve(root, 'apps/ui/dist'), dataDir: dataDirectory(), onExit: message => { console.error(message); process.exit(1) } })
console.log(`Abre Veltria en este equipo:\n${service.ready.origin}/#launch=${service.ready.nonce}`)
console.log(service.owned ? 'Ctrl+C cierra este servicio. La URL de apertura vence en 60 segundos.' : 'Conectado al servicio existente. Este lanzador no lo cerrará.')
if (service.owned) {
  let stopping = false
  const stop = async () => { if (stopping) return; stopping = true; await service.stop(); process.exit(0) }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
}
