import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import type { Hardware, Settings } from '@veltria/contracts'
import { starterProfile, recipeNodes, type ImageProfile } from '@veltria/core'
import type { ImageEngine } from '../packages/adapters/src/image-engine'
export const fixtureHardware: Hardware = {
  sampledAt: new Date().toISOString(), host: 'Fixture · no hardware real', platform: 'win32', arch: 'x64', release: 'fixture', wsl: false,
  cpu: { name: 'CPU de prueba', logicalCores: 4, source: 'fixture' }, ram: { total: 16 * 1024 ** 3, available: 8 * 1024 ** 3, source: 'fixture' },
  disk: { total: 100 * 1024 ** 3, available: 20 * 1024 ** 3, path: '/fixture', source: 'fixture' },
  gpus: [{ name: 'NVIDIA fixture · sin GPU de prueba', vramTotal: 6 * 1024 ** 3, vramAvailable: 5 * 1024 ** 3, driver: 'fixture', source: 'fixture' }], notes: ['No representa una detección ni una generación GPU.']
}
function crc32(buffer: Buffer) { let crc = -1; for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0) } return (crc ^ -1) >>> 0 }
export function fixturePng(width: number, height: number) {
  const chunk = (type: string, data: Buffer) => { const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, crc]) }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const offset = y * (width * 3 + 1) + 1 + x * 3; rows[offset] = 194; rows[offset + 1] = 145; rows[offset + 2] = 79 }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}
export class CreationFixture {
  bytes = Buffer.alloc(512 * 1024, 41)
  ranges: string[] = []
  submissions: any[] = []
  cancellations: string[] = []
  complete = true
  memoryModes: (string|undefined)[] = []
  failure = false
  failureDetails: Record<string, any> | null = null
  wrongHash = false
  ignoreRange = false
  downloadDelay = 12
  availableBytes = 20 * 1024 ** 3
  downloads = 0
  server: ReturnType<typeof Bun.serve>
  profile: ImageProfile
  engine: ImageEngine
  private accepted = new Map<string, any>()
  constructor() {
    this.server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: async request => {
      const url = new URL(request.url), path = url.pathname
      if (path === '/checkpoint') {
        this.downloads++
        const range = request.headers.get('range'); if (range) this.ranges.push(range)
        const start = !this.ignoreRange && range ? Number(/^bytes=(\d+)-$/.exec(range)?.[1] || 0) : 0
        let offset = start, timer: ReturnType<typeof setInterval>
        const stream = new ReadableStream<Uint8Array>({ start: controller => {
          timer = setInterval(() => {
            if (offset >= this.bytes.length) { clearInterval(timer); controller.close(); return }
            const end = Math.min(offset + 4096, this.bytes.length)
            controller.enqueue(this.wrongHash ? Buffer.alloc(end - offset, 42) : this.bytes.subarray(offset, end)); offset = end
          }, this.downloadDelay)
        }, cancel() { clearInterval(timer) } })
        return new Response(stream, { status: start ? 206 : 200, headers: { 'content-length': String(this.bytes.length - start), ...(start ? { 'content-range': `bytes ${start}-${this.bytes.length - 1}/${this.bytes.length}` } : {}) } })
      }
      if (path === '/system_stats') return Response.json({ system: { comfyui_version: 'fixture-no-GPU' }, devices: [{ name: 'Dispositivo de prueba' }] })
      if (path === '/object_info') return Response.json(Object.fromEntries([...recipeNodes, 'LoraLoader'].map(node => [node, node === 'CheckpointLoaderSimple' ? { input: { required: { ckpt_name: [[this.profile.filename]] } } } : {}])))
      if (path === '/queue') return Response.json({ queue_running: [], queue_pending: [] })
      if (path === '/prompt' && request.method === 'POST') {
        const input: any = await request.json(); this.submissions.push(input); this.accepted.set(input.prompt_id, input)
        return Response.json({ prompt_id: input.prompt_id, number: this.submissions.length })
      }
      if (path.startsWith('/history/')) {
        const id = path.split('/').pop()!, input = this.accepted.get(id)
        if (!input || !this.complete || this.cancellations.includes(id)) return Response.json({})
        return Response.json({ [id]: this.failure ? { status: { status_str: 'error', completed: false, messages: [['execution_error', this.failureDetails || {}]] } } : { status: { completed: true, status_str: 'success' }, outputs: { '7': { images: [{ filename: `veltria_${id}_00001_.png`, type: 'output', subfolder: '' }] } } } })
      }
      if (/^\/api\/jobs\/[a-f0-9-]+\/cancel$/.test(path)) { const id = path.split('/')[3]; this.cancellations.push(id); return Response.json({ cancelled: true }) }
      if (path === '/view') {
        const id = url.searchParams.get('filename')?.match(/^veltria_([a-f0-9-]+)_/)?.[1], input = id && this.accepted.get(id)
        if (!input) return new Response('', { status: 404 })
        return new Response(fixturePng(input.prompt['4'].inputs.width, input.prompt['4'].inputs.height), { headers: { 'content-type': 'image/png' } })
      }
      return new Response('fixture route missing', { status: 404 })
    } })
    const fixture = this
    this.profile = { ...starterProfile, id: 'fixture-profile', title: 'Perfil de prueba · sin GPU', bytes: this.bytes.length, sha256: createHash('sha256').update(this.bytes).digest('hex'), filename: 'fixture-only.safetensors', url: `http://127.0.0.1:${this.server.port}/checkpoint`, description: 'Fixture de pruebas, no un perfil distribuido.' }
    this.engine = { origin: null, version: 'fixture-no-GPU', async start(...args: any[]) { fixture.memoryModes.push(args[4]); (this as any).origin = `http://127.0.0.1:${fixture.server.port}` }, async stop() { (this as any).origin = null } }
  }
  async binding(directory: string): Promise<NonNullable<Settings['engineBinding']>> {
    const root = join(directory, 'existing engine fixture'); await mkdir(join(root, 'comfy'), { recursive: true })
    await writeFile(join(root, 'main.py'), '# fixture; never executed')
    await writeFile(join(root, 'folder_paths.py'), '# fixture')
    await writeFile(join(root, 'server.py'), '# /api/jobs/{job_id}/cancel interrupt_if_running')
    await writeFile(join(root, 'comfyui_version.py'), '__version__ = "fixture"')
    await writeFile(join(root, 'comfy', 'cli_args.py'), '--extra-model-paths-config --user-directory --disable-all-custom-nodes --database-url')
    const env = join(root, 'env', process.platform === 'win32' ? 'Scripts' : 'bin'); await mkdir(env, { recursive: true })
    const python = join(env, process.platform === 'win32' ? 'python.exe' : 'python'); await writeFile(python, process.platform === 'win32' ? Buffer.from('MZfixture') : Buffer.from('7f454c46', 'hex'), { mode: 0o700 })
    return { directory: root, python }
  }
  stop() { this.server.stop(true) }
}
