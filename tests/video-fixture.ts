import { readFile } from 'node:fs/promises'
import type { ImageEngine } from '../packages/adapters/src/image-engine'
import { videoFiles } from '@veltria/core'
import type { VideoComponent } from '@veltria/contracts'
import type { VideoOptions } from '../apps/local-service/src/video'
import { fixtureHardware } from './creation-fixture'

/** Synthetic H.264 fixture, visibly labelled NO AI. Never imported by a production entrypoint. */
export class VideoFixture {
  submissions: any[] = []
  cancellations: string[] = []
  complete = true
  fail = false
  lostResponse = false
  badOutput = false
  startDelay = 0
  componentsValid = true
  modified = 1
  server: ReturnType<typeof Bun.serve>
  engine: ImageEngine
  options: Pick<VideoOptions, 'engine' | 'components' | 'hardware' | 'probe' | 'disk'>
  constructor() {
    const accepted = new Set<string>()
    this.server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: async request => {
      const path = new URL(request.url).pathname
      if (path === '/queue') return Response.json({ queue_running: [], queue_pending: [] })
      if (path === '/prompt') { const input: any = await request.json(); this.submissions.push(input); accepted.add(input.prompt_id); return Response.json(this.lostResponse ? { prompt_id: crypto.randomUUID() } : { prompt_id: input.prompt_id }) }
      if (path.startsWith('/history/')) {
        const id = path.split('/').pop()!
        if (!accepted.has(id) || !this.complete || this.cancellations.includes(id)) return Response.json({})
        return Response.json({ [id]: this.fail ? { status: { status_str: 'error' } } : { status: { completed: true }, outputs: { '15': { images: [{ filename: this.badOutput ? '../unowned.mp4' : `veltria_video_${id}_00001_.mp4`, subfolder: '', type: 'output' }], animated: [true] } } } })
      }
      if (path === '/view') return new Response(await readFile(new URL('./fixtures/video-preview.mp4', import.meta.url)), { headers: { 'content-type': 'video/mp4' } })
      if (/^\/api\/jobs\/[a-f0-9-]+\/cancel$/.test(path)) { this.cancellations.push(path.split('/')[3]); return Response.json({ cancelled: true }) }
      return new Response('', { status: 404 })
    } })
    const fixture = this
    this.engine = { origin: null, version: 'video-fixture-no-AI', async start() { if (fixture.startDelay) await Bun.sleep(fixture.startDelay); (this as any).origin = `http://127.0.0.1:${fixture.server.port}` }, async stop() { (this as any).origin = null } }
    this.options = {
      engine: this.engine,
      hardware: async () => fixtureHardware,
      disk: async () => 10 * 1024 ** 3,
      components: async () => videoFiles.map(file => ({ role: file.role, filename: file.filename, path: `/fixture/${file.folder}/${file.filename}`, bytes: 1000, modified: this.modified, status: this.componentsValid ? 'present' : 'missing' } as VideoComponent)),
      probe: async () => ({ width: 448, height: 256, frames: 22, fps: 24, duration: 22 / 24, codec: 'h264', audio: false })
    }
  }
  stop() { this.server.stop(true) }
}
