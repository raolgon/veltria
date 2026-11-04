// Test-only native helper; not a product entrypoint or an API.
import { inspectVideoFile } from '../packages/adapters/src/video'
if (!process.argv[2] || !process.argv[3]) throw new Error('Arguments: own MP4 fixture path, existing Python path')
console.log(JSON.stringify(await inspectVideoFile(process.argv[2], process.argv[3])))
