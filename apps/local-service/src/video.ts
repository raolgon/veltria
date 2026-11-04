import { createHash, randomBytes } from 'node:crypto'
import { mkdir, statfs, open, rename, unlink, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { videoPlanSchema, videoStateSchema, type VideoPlan, type VideoState, type VideoJob, type VideoComponent, type VideoMetadata, type Settings, type Hardware } from '@veltria/contracts'
import { videoWorkflow, videoPresets, videoRevision, videoNodes } from '@veltria/core'
import { SettingsRepository, detectHardware } from '@veltria/adapters'
import { LocalImageEngine, engineJson, type ImageEngine } from '../../../packages/adapters/src/image-engine'
import { existingVideoComponents, validateVideoNodes, inspectVideoFile } from '../../../packages/adapters/src/video'
import { fileBytes, hashFile } from '../../../packages/adapters/src/profile-download'
import { VideoStore } from './video-store'
import { CreationError } from './creation'

const now = () => new Date().toISOString()
const terminal = (job: VideoJob) => ['completed', 'failed', 'cancelled', 'interrupted'].includes(job.status)
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new DOMException('Operación detenida', 'AbortError')) }
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 1000)
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true })
})
export type VideoOptions = {
  dataDir: string; repository: SettingsRepository; changed: () => void; engine?: ImageEngine;
  hardware?: () => Promise<Hardware>; components?: (binding: Settings['engineBinding']) => Promise<VideoComponent[]>;
  probe?: (path: string, python: string) => Promise<VideoMetadata>; disk?: () => Promise<number | null>
}
export class VideoController {
  readonly store: VideoStore
  private engine: ImageEngine
  private preparation: VideoState['preparation']
  private task: Promise<void> | null = null
  private abort: AbortController | null = null
  private preparing: Promise<void> | null = null
  private preparationAbort: AbortController | null = null
  private planCache: { value: VideoPlan; at: number } | null = null
  private closing = false
  constructor(private options: VideoOptions) {
    this.store = new VideoStore(options.repository.db)
    this.engine = options.engine || new LocalImageEngine(options.dataDir, { folder: 'video-engine', requiredNodes: videoNodes, validateNodes: validateVideoNodes })
    this.preparation = this.store.preparation() || { status: 'idle', revision: '', message: 'Revisa el modelo de video que ya tienes instalado.' }
    if (this.preparation.status === 'checking') this.setPreparation({ status: 'idle', message: 'La comprobación de video se interrumpió. Puedes volver a prepararlo.' })
    for (const job of this.store.jobs(0, 100000)) if (!terminal(job)) this.save({ ...job, status: 'interrupted', message: 'La creación de video se interrumpió. No se volverá a enviar automáticamente.' })
  }
  private save(job: VideoJob) { job.updatedAt = now(); this.store.save(job); this.options.changed() }
  private setPreparation(patch: Partial<VideoState['preparation']>) { this.preparation = { ...this.preparation, ...patch }; this.store.savePreparation(this.preparation); this.options.changed() }
  async plan(force = false): Promise<VideoPlan> {
    if (!force && this.planCache && Date.now() - this.planCache.at < 30000) return this.planCache.value
    const binding = this.options.repository.get().engineBinding
    const [components, hardware, available] = await Promise.all([
      (this.options.components || existingVideoComponents)(binding), (this.options.hardware || (() => detectHardware(this.options.dataDir)))(),
      this.options.disk ? this.options.disk() : statfs(this.options.dataDir).then(value => value.bavail * value.bsize).catch(() => null)
    ])
    const gpu = hardware.gpus.find(value => /nvidia/i.test(value.name)), blockers: string[] = [], warnings = [
      'MiniMax H3 es experimental en este primer perfil. Tener los archivos no confirma que el video pueda generarse en tu equipo.',
      'Las vistas previas son más cortas que el rango de entrenamiento del modelo. La calidad, el movimiento y el audio pueden fallar.',
      'Se reutilizan los archivos existentes. Se comprueban sus cabeceras y tamaño; no se afirma una verificación SHA-256 de los pesos.'
    ]
    if (!binding) blockers.push('Vincula primero tu instalación existente de ComfyUI en Mi equipo.')
    if (components.length !== 4 || components.some(file => file.status !== 'present')) blockers.push('Faltan componentes válidos del perfil de video. No se descargará nada automáticamente.')
    if (!['win32', 'linux'].includes(hardware.platform) || !gpu || (gpu.vramTotal ?? 0) < 5.5 * 1024 ** 3) blockers.push('Este perfil de video necesita Windows o Linux y una GPU NVIDIA de al menos 6 GB nominales; otros equipos no se han validado.')
    if ((hardware.ram.total ?? 0) < 28 * 1024 ** 3) warnings.unshift('Tu equipo tiene menos de 32 GB de RAM nominales. Estos pesos grandes pueden agotar la memoria; este perfil no se recomienda como una opción fiable para tu equipo.')
    if (available === null || available < 512 * 1024 ** 2) blockers.push('Se necesitan al menos 512 MiB libres en el disco de datos para guardar el video y sus temporales.')
    const engineVersionFile = binding ? await readFile(join(binding.directory, 'comfyui_version.py'), 'utf8').catch(() => '') : ''
    const revision = digest({ recipe: videoRevision, binding, engineVersionFile, components, hardware: { platform: hardware.platform, cpu: hardware.cpu.name, ram: hardware.ram.total, gpu: gpu && [gpu.name, gpu.vramTotal, gpu.driver] } })
    const value = videoPlanSchema.parse({ revision, model: 'MiniMax H3', components, blockers, warnings, downloadBytes: 0, requiredBytes: 512 * 1024 ** 2, availableBytes: available, canPrepare: !blockers.length, experimental: true, ramTotal: hardware.ram.total, ramAvailable: hardware.ram.available, vramTotal: gpu?.vramTotal ?? null, source: 'https://huggingface.co/Comfy-Org/MiniMax-H3', licenseUrl: 'https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE' })
    this.planCache = { value, at: Date.now() }; return value
  }
  async state(): Promise<VideoState> {
    if (!this.options.repository.get().engineBinding) return { preparation: this.preparation, activeJob: null, canCreate: false, experimental: true, verifiedPresets: [] }
    const plan = await this.plan()
    const active = this.store.jobs(0, 100000).find(job => !terminal(job)) || null
    const verified = this.store.jobs(0, 100000).filter(job => job.status === 'completed' && job.revision === plan.revision).map(job => job.preset)
    return videoStateSchema.parse({ preparation: this.preparation, activeJob: active, canCreate: plan.canPrepare && this.preparation.status === 'ready' && this.preparation.revision === plan.revision && this.store.authorized(plan.revision), experimental: true, verifiedPresets: [...new Set(verified)] })
  }
  activity() { return { preparing: !!this.preparing, jobs: this.store.jobs(0, 100000).filter(job => !terminal(job) || job.status === 'interrupted' && job.enginePromptId && job.engineUrl === this.engine.origin).length, settling: !!this.task } }
  assertMutable() { const active = this.activity(); if (active.preparing || active.jobs || active.settling) throw new CreationError('Hay una creación o comprobación de video activa. Espera a que termine o cancélala.') }
  async releaseEngine() { this.assertMutable(); await this.engine.stop() }
  async configurationChanged() { await this.releaseEngine(); this.planCache = null; this.setPreparation({ status: 'idle', revision: '', message: 'La instalación cambió. Revisa de nuevo el perfil de video.' }) }
  async prepare(revision: string): Promise<VideoState['preparation']> {
    if (this.closing) throw new CreationError('El servicio está cerrando.')
    this.assertMutable()
    const plan = await this.plan(true)
    if (revision !== plan.revision) throw new CreationError('El plan de video cambió. Revísalo antes de preparar.')
    if (!plan.canPrepare) throw new CreationError(plan.blockers.join(' '))
    this.store.authorize(revision, plan)
    this.setPreparation({ status: 'checking', revision, message: 'Comprobando los componentes de video y las capacidades del motor…' })
    const abort = new AbortController(); this.preparationAbort = abort
    this.preparing = (async () => {
      try { await this.ensureEngine(abort.signal); this.setPreparation({ status: 'ready', message: 'Perfil de video comprobado. La generación sigue sin verificar hasta completar una prueba real.' }) }
      catch (error) { this.setPreparation({ status: 'error', message: abort.signal.aborted ? 'La comprobación de video se detuvo. Tus archivos se conservan.' : error instanceof Error ? error.message : 'No se pudo preparar el video. Revisa los componentes y video-engine/engine.log; la instalación existente se conserva.' }) }
    })().finally(() => { this.preparing = null; this.preparationAbort = null })
    return this.preparation
  }
  async pause() { this.preparationAbort?.abort(); await this.preparing; return this.preparation }
  private async ensureEngine(signal: AbortSignal) {
    const binding = this.options.repository.get().engineBinding
    if (!binding) throw new CreationError('Vincula primero tu instalación existente de ComfyUI en Mi equipo.')
    await this.engine.start(binding, this.options.repository.get().modelsDirectory || join(this.options.dataDir, 'models'), '', signal)
  }
  async create(input: { requestId: string; prompt: string; preset: keyof typeof videoPresets }) {
    const existing = this.store.byRequest(input.requestId)
    if (existing) { if (existing.prompt !== input.prompt || existing.preset !== input.preset) throw new CreationError('Ese identificador ya pertenece a otra creación.'); return existing }
    this.assertMutable()
    await this.plan(true)
    const state = await this.state()
    if (!state.canCreate) throw new CreationError('Revisa y prepara el perfil de video antes de crear.')
    if (input.preset === 'short' && !state.verifiedPresets.includes('preview')) throw new CreationError('Completa primero una vista previa en este equipo antes de crear un clip más largo.')
    const raced = this.store.byRequest(input.requestId)
    if (raced) { if (raced.prompt !== input.prompt || raced.preset !== input.preset) throw new CreationError('Ese identificador ya pertenece a otra creación.'); return raced }
    this.assertMutable()
    const job: VideoJob = { id: crypto.randomUUID(), ...input, ...videoPresets[input.preset], status: 'queued', seed: randomBytes(4).readUInt32LE(), step: null, message: 'Video en espera.', createdAt: now(), updatedAt: now(), enginePromptId: null, engineUrl: null, engineVersion: null, revision: this.preparation.revision, artifactId: null, sha256: null, metadata: null }
    this.save(job)
    const abort = new AbortController(); this.abort = abort
    this.task = this.run(job, abort.signal).finally(() => { this.task = null; this.abort = null })
    return job
  }
  private async run(initial: VideoJob, signal: AbortSignal) {
    let job = initial, socket: WebSocket | undefined
    const update = (patch: Partial<VideoJob>) => { const latest = this.store.job(job.id); if (latest && terminal(latest)) return; job = { ...job, ...patch }; this.save(job) }
    try {
      update({ message: 'Abriendo el motor para crear tu video…' }); await this.ensureEngine(signal); signal.throwIfAborted()
      if (this.store.job(job.id)?.status === 'cancelled') return
      const origin = this.engine.origin!, clientId = crypto.randomUUID()
      const queue = await engineJson(origin, '/queue', undefined, signal)
      if (!Array.isArray(queue.queue_running) || !Array.isArray(queue.queue_pending)) throw new Error('El motor no devolvió una cola válida.')
      socket = new WebSocket(`${origin.replace('http:', 'ws:')}/ws?clientId=${clientId}`)
      socket.onmessage = event => {
        if (typeof event.data !== 'string' || event.data.length > 64000) return
        try {
          const value = JSON.parse(event.data), data = value.data
          if (data?.prompt_id !== job.enginePromptId || terminal(this.store.job(job.id)!)) return
          if (value.type === 'progress' && Number.isFinite(data.value) && Number.isFinite(data.max) && data.max > 0) update({ status: 'running', step: Math.min(data.value, data.max), steps: data.max, message: `Creando el video · paso ${data.value} de ${data.max}` })
          if (value.type === 'executing' && ['12', '13', '14', '15'].includes(data.node)) update({ message: 'Decodificando y guardando el video y su audio…' })
        } catch { /* events never replace job identity */ }
      }
      update({ status: 'submitting', enginePromptId: job.id, engineUrl: origin, engineVersion: this.engine.version, message: 'Enviando tu video al motor…' })
      try {
        const accepted = await engineJson(origin, '/prompt', { prompt_id: job.id, client_id: clientId, prompt: videoWorkflow(job.prompt, job.preset, job.seed, job.id) }, signal)
        if (accepted.prompt_id !== job.id) throw new Error('Identidad no confirmada')
      } catch { update({ status: 'interrupted', message: 'No se pudo confirmar el envío del video. Se conserva su identificador; comprueba el resultado antes de crear otro.' }); return }
      update({ status: 'running', message: 'Cargando los modelos de video. El primer paso puede tardar; no hay una estimación verificada.' })
      const deadline = Date.now() + 30 * 60 * 1000
      while (Date.now() < deadline) {
        signal.throwIfAborted()
        if (this.store.job(job.id)?.status === 'cancelled') return
        const history = await engineJson(origin, `/history/${job.id}`, undefined, signal), entry = history[job.id]
        if (entry?.status?.status_str === 'error' || entry?.status?.messages?.some((value: any) => ['execution_error', 'execution_interrupted'].includes(value?.[0]))) throw new Error('El motor no pudo crear el video. Conservamos tu descripción; revisa la memoria disponible antes de reintentar.')
        const result = entry?.outputs?.['15']?.images?.[0]
        if (result && entry.status?.completed !== false) {
          update({ status: 'saving', message: 'Comprobando el MP4 y guardándolo en la biblioteca…' })
          const artifact = await this.saveResult(origin, result, job, signal)
          update({ ...artifact, status: 'completed', artifactId: job.id, step: job.steps, message: 'Video creado y guardado en tu biblioteca.' }); return
        }
        await wait(signal)
      }
      update({ status: 'interrupted', message: 'La espera del video superó treinta minutos. No se repetirá automáticamente; puedes comprobar el resultado o cancelarlo.' })
    } catch (error) { update({ status: signal.aborted ? 'interrupted' : 'failed', message: signal.aborted ? 'La creación de video se interrumpió. No se volverá a enviar automáticamente.' : error instanceof Error ? error.message : 'No se pudo crear el video.' }) }
    finally { socket?.close() }
  }
  private async probe(path: string, job: VideoJob) {
    const binding = this.options.repository.get().engineBinding
    if (!binding) throw new Error('No se pudo comprobar el video sin el Python vinculado.')
    const metadata = await (this.options.probe || inspectVideoFile)(path, binding.python)
    if (metadata.width !== job.width || metadata.height !== job.height || Math.abs(metadata.fps - job.fps) > 0.1 || Math.abs(metadata.duration - job.frames / job.fps) > 0.15 || metadata.frames && metadata.frames !== job.frames) throw new Error('El MP4 no coincide con las dimensiones y duración solicitadas.')
    return metadata
  }
  private async saveResult(origin: string, result: any, job: VideoJob, signal: AbortSignal) {
    const filename = result?.filename, subfolder = result?.subfolder || ''
    if (typeof filename !== 'string' || !filename.startsWith(`veltria_video_${job.id}_`) || !/^[A-Za-z0-9_.-]+\.mp4$/.test(filename) || result.type !== 'output' || typeof subfolder !== 'string' || subfolder.includes('..') || /[\\:\x00]/.test(subfolder) || subfolder.startsWith('/')) throw new Error('El motor devolvió una referencia de video no admitida.')
    const response = await fetch(`${origin}/view?${new URLSearchParams({ filename, subfolder, type: 'output' })}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]), redirect: 'error' })
    if (!response.ok || !response.body) throw new Error('No se pudo recuperar el video del motor. Su resultado original se conserva.')
    if (Number(response.headers.get('content-length') || 0) > 256 * 1024 ** 2) { await response.body.cancel(); throw new Error('El archivo de video tiene un tamaño no admitido.') }
    const directory = join(this.options.dataDir, 'videos'); await mkdir(directory, { recursive: true, mode: 0o700 })
    const final = join(directory, `${job.id}.mp4`), temp = join(directory, `${job.id}.${crypto.randomUUID()}.mp4.part`)
    const file = await open(temp, 'wx', 0o600), reader = response.body.getReader(), hash = createHash('sha256'); let length = 0
    try {
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break
          length += value.length; if (length > 256 * 1024 ** 2) throw new Error('El archivo de video tiene un tamaño no admitido.')
          hash.update(value); let offset = 0
          while (offset < value.length) { const part = await file.write(value, offset, value.length - offset); if (!part.bytesWritten) throw new Error('No se pudo escribir en disco.'); offset += part.bytesWritten }
        }
        await file.sync()
      } finally { await reader.cancel().catch(() => {}); await file.close() }
      const sha256 = hash.digest('hex'), metadata = await this.probe(temp, job); signal.throwIfAborted()
      if (await fileBytes(final)) { if (await hashFile(final, signal) !== sha256) throw new Error('Ya existe un resultado distinto para este trabajo. Se conserva intacto.') }
      else {
        // Persist evidence before promoting, so a restart can reconcile a completed local file.
        this.save({ ...job, metadata, sha256 }); await rename(temp, final)
      }
      return { metadata, sha256 }
    } finally { await unlink(temp).catch(() => {}) }
  }
  async cancel(id: string) {
    const job = this.store.job(id); if (!job) throw new CreationError('No se encontró ese video.', 404)
    if (terminal(job) && job.status !== 'interrupted') return job
    if (['submitting', 'saving'].includes(job.status)) throw new CreationError('El video se está enviando o guardando. Espera un momento para cancelarlo con seguridad.')
    if (job.enginePromptId && job.engineUrl) {
      if (job.engineUrl !== this.engine.origin) throw new CreationError('No se puede confirmar el motor de este trabajo. No se cancelará ningún otro proceso.')
      await engineJson(job.engineUrl, `/api/jobs/${job.enginePromptId}/cancel`, {})
    }
    const latest = this.store.job(id)!; if (terminal(latest) && latest.status !== 'interrupted') return latest
    const value = { ...latest, status: 'cancelled' as const, message: 'Video cancelado. Tu descripción se conserva.' }; this.save(value); return value
  }
  async reconcile(id: string) {
    const job = this.store.job(id)
    if (!job || job.status !== 'interrupted' || !job.enginePromptId || !job.engineUrl) throw new CreationError('Este video no tiene un envío pendiente de comprobar.')
    const path = join(this.options.dataDir, 'videos', `${job.id}.mp4`)
    let artifact: { metadata: VideoMetadata; sha256: string }
    if (await fileBytes(path) && job.sha256) {
      if (await hashFile(path) !== job.sha256) throw new CreationError('El archivo de video guardado cambió. Se conserva sin sustituirlo.')
      artifact = { metadata: await this.probe(path, job), sha256: job.sha256 }
    } else {
      const history = await engineJson(job.engineUrl, `/history/${job.enginePromptId}`), result = history[job.enginePromptId]?.outputs?.['15']?.images?.[0]
      if (!result) throw new CreationError('Todavía no hay un video recuperable en ese motor. No se ha vuelto a generar.')
      artifact = await this.saveResult(job.engineUrl, result, job, new AbortController().signal)
    }
    const value = { ...job, ...artifact, status: 'completed' as const, artifactId: job.id, message: 'Video recuperado sin repetir la generación.' }; this.save(value); return value
  }
  artifact(id: string) { const job = this.store.job(id); if (!job || job.status !== 'completed' || job.artifactId !== id) throw new CreationError('No se encontró ese video.', 404); return join(this.options.dataDir, 'videos', `${id}.mp4`) }
  async close() {
    this.closing = true; this.abort?.abort(); this.preparationAbort?.abort(); await this.engine.stop()
    await Promise.allSettled([this.task, this.preparing].filter(Boolean))
  }
}
