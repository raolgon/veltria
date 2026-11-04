import { dirname, join } from 'node:path'
import { dataDirectory } from './paths'
import { launchService } from './supervisor'
// Standalone distribution: launcher includes Bun, backend remains the same separate helper.
const root = dirname(process.execPath)
const service = await launchService({ executable: join(root, 'resources', 'service', process.platform === 'win32' ? 'veltria-service.exe' : 'veltria-service'), uiDir: join(root, 'resources', 'ui'), dataDir: dataDirectory(), onExit: message => { console.error(message); process.exit(1) } })
console.log(`Abre Veltria en este equipo:\n${service.ready.origin}/#launch=${service.ready.nonce}`)
console.log(service.owned ? 'Ctrl+C cierra el servicio. El enlace de apertura vence en 60 segundos.' : 'Conectado al servicio existente; este lanzador no lo cerrará.')
let stopping = false
async function stop() { if (stopping) return; stopping = true; await service.stop(); process.exit(0) }
if (service.owned) { process.on('SIGINT', stop); process.on('SIGTERM', stop) }
