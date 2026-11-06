import { createHash, randomBytes } from 'node:crypto'
import { mkdir, statfs, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { join, dirname, resolve, isAbsolute } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { creationStateSchema, preparationPlanSchema, type CreateImageInput, type CreationState, type Preparation, type PreparationPlan, type ImageJob, type Settings, type Hardware, type Catalog, type ConfigurationEntry, imageConfigurationSchema } from '@veltria/contracts'
import { recommendImage, profileDimensions, validImageQuality, imageWorkflow, type ImageProfile, imageModels, configurationsFor, configurationRevision } from '@veltria/core'
import { detectHardware, SettingsRepository } from '@veltria/adapters'
import { downloadProfileFile, finishProfileFile, fileBytes } from '../../../packages/adapters/src/profile-download'
import { LocalImageEngine, engineJson, type ImageEngine } from '../../../packages/adapters/src/image-engine'
import { resolveModel } from './discovery'
import { ModelStorage } from './model-storage'
import { CreationStore } from './creation-store'

export class CreationError extends Error { constructor(message: string, readonly statusCode = 409) { super(message); this.name = 'CreationError' } }
const now = () => new Date().toISOString()
const terminal = (job: ImageJob) => ['completed', 'cancelled', 'failed', 'interrupted'].includes(job.status)
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function preparationError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/ENOSPC|no space/i.test(message)) return 'Se agotó el espacio del disco. La parte recuperable se conserva; libera espacio o elige otra ubicación.'
  if (/EACCES|EPERM|permission denied/i.test(message)) return 'Veltria no tiene permiso para escribir en esa ubicación. Elige otra carpeta; tus archivos existentes se conservan.'
  if (/fetch|socket|connection|ECONN|ETIMEDOUT|TLS|certificate|timeout/i.test(message)) return 'Se interrumpió la conexión con el origen. Se conserva la parte recuperable; pulsa Continuar preparación para reintentar.'
  return message || 'No se pudo preparar el perfil. Se conserva el progreso recuperable.'
}
const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
  const abort = () => { clearTimeout(timer); reject(new DOMException('Operación detenida', 'AbortError')) }
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true })
})
async function diskAvailable(path: string): Promise<number | null> {
  let current = resolve(path)
  for (;;) {
    try { const disk = await statfs(current); return disk.bavail * disk.bsize }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(current) === current) return null; current = dirname(current) }
  }
}
type Options = { dataDir: string; repository: SettingsRepository; changed: (kind: 'creation' | 'jobs') => void; profile?: ImageProfile; profiles?: ImageProfile[]; hardware?: () => Promise<Hardware>; disk?: (path: string) => Promise<number | null>; engine?: ImageEngine; allowLocalFixture?: boolean }
export class CreationController {
  readonly store: CreationStore
  private configuration: ConfigurationEntry
  get models(): readonly ImageProfile[] { return [...(this.options.profiles || (this.options.profile ? [this.options.profile] : imageModels)), ...this.discoveredModels()] }
  private discoveredModels(): ImageProfile[] { return (this.options.repository.db.query('SELECT data FROM discovered_models').all() as {data:string}[]).map(row => JSON.parse(row.data)) }
  async adoptModel(repo: string, file: string, strength = 0.7, baseModelId = 'sd15-starter') {
    this.assertConfigurationMutable()
    if (!this.models.some(model => model.id === baseModelId && !model.adaptation && model.family!=='sdxl')) throw new CreationError('No se encontró un modelo base compatible.')
    const profile = await resolveModel(repo, file, strength, baseModelId)
    this.assertConfigurationMutable()
    if (this.discoveredModels().length >= 100 && !this.models.some(model => model.id === profile.id)) throw new CreationError('El catálogo admite hasta 100 modelos añadidos.')
    if (!this.models.some(model => model.id === profile.id)) this.options.repository.db.query('INSERT OR IGNORE INTO discovered_models VALUES (?,?)').run(profile.id, JSON.stringify(profile))
    this.options.changed('creation')
    return configurationsFor(profile)[0]
  }
  get profile(): ImageProfile { return this.models.find(model => model.id === this.configuration.configuration.modelId)! }
  configurations() { return [...this.models.flatMap(configurationsFor), ...this.store.configurations()] }
  configurationEntry(id: string) {
    const entry = this.configurations().find(item => item.id === id)
    if (!entry) throw new CreationError('No se encontró esa configuración en el catálogo.', 404)
    return entry
  }
  importConfiguration(value: unknown) {
    const configuration = imageConfigurationSchema.parse(value)
    if (!this.models.some(model => model.id === configuration.modelId)) throw new CreationError('Esta configuración necesita un modelo que todavía no admite Veltria.', 400)
    const model=this.models.find(item=>item.id===configuration.modelId)!
    if(configuration.recipe !== (model.family==='sdxl'?'sdxl-text-to-image-v1':'sd15-text-to-image-v1')) throw new CreationError('La receta no corresponde a la familia del modelo.',400)
    const entry: ConfigurationEntry = { id: `imported-${digest(configuration)}`, configuration, origin: 'imported' }
    if (this.store.configurations().length >= 100 && !this.store.configurations().some(item => item.id === entry.id)) throw new CreationError('Ya hay 100 configuraciones importadas. No se ha añadido otra.', 409)
    this.store.saveConfiguration(entry); this.options.changed('creation'); return entry
  }
  async selectConfiguration(id: string) {
    this.assertConfigurationMutable()
    const entry = this.configurationEntry(id), changedModel = entry.configuration.modelId !== this.profile.id
    if (changedModel) await this.engine.stop()
    this.configuration = entry; this.store.select(id)
    if (changedModel) this.restorePreparation()
    this.options.changed('creation')
    return this.state()
  }
  private restorePreparation() {
    this.preparation = this.store.preparation(this.profile.id) || this.idle()
    if (['downloading', 'verifying', 'starting'].includes(this.preparation.status)) this.setPreparation({ status: 'paused', message: 'La preparación se interrumpió. Puedes continuar; se comprobarán los archivos conservados.' })
  }
  async catalog(): Promise<Catalog> {
    const state = await this.state(), selected = this.profile.id
    const models = await Promise.all(this.models.map(async profile => {
      const destination = this.componentPath(profile)
      const size = await fileBytes(destination).catch(() => 0), partial = await fileBytes(`${destination}.part`).catch(() => 0)
      const preparation = profile.id === selected ? this.preparation : this.store.preparation(profile.id)
      const prepared = preparation?.status === 'ready' && preparation.verifiedHash === profile.sha256 && preparation.revision === this.revisionFor(profile) && size === profile.bytes
      const recommendation = profile.id === selected ? state.recommendation : { ...recommendImage(await this.hardware(), profile), verified: false, evidence: null }
      const remainingBytes = (await this.componentBytes(profile)).reduce((sum, item) => sum + item.profile.bytes - item.received, 0)
      return { profile, remainingBytes, received: size === profile.bytes ? size : Math.min(partial, profile.bytes), status: prepared ? 'prepared' as const : size === profile.bytes ? 'downloaded' as const : partial ? 'partial' as const : 'missing' as const, recommendation }
    }))
    return { models, configurations: this.configurations(), selectedModelId: selected, selectedConfigurationId: this.configuration.id, busy: this.managingFiles || this.startingPrepare || this.activity().preparing || this.activity().jobs > 0 }
  }
  private engine: ImageEngine
  private preparation!: Preparation
  private preparationTask: Promise<void> | null = null
  private preparationAbort: AbortController | null = null
  private generationTask: Promise<void> | null = null
  private generationAbort: AbortController | null = null
  private managingFiles = false
  private startingPrepare = false
  private closing = false
  private hardwareCache: { value: Hardware; at: number } | null = null
  private preparationProgressAt = 0
  constructor(private options: Options) {
    options.repository.db.exec('CREATE TABLE IF NOT EXISTS discovered_models (id TEXT PRIMARY KEY, data TEXT NOT NULL)')
    this.store = new CreationStore(options.repository.db)
    this.configuration = this.configurations().find(item => item.id === this.store.selection()) || configurationsFor(this.models[0])[0]
    this.engine = options.engine || new LocalImageEngine(options.dataDir)
    this.restorePreparation()
    // A restart cannot silently resubmit accepted GPU work. Preserve its inputs and exact engine id.
    for (const job of this.store.jobs(0, 10000)) if (!terminal(job)) this.saveJob({ ...job, status: 'interrupted', message: 'Veltria se cerró durante este trabajo. Se conservan su descripción y ajustes; no se ha vuelto a generar automáticamente.' })
  }
  private idle(): Preparation { return { id: crypto.randomUUID(), profileId: this.profile.id, revision: '', status: 'idle', received: 0, total: this.components().reduce((sum, item) => sum + item.bytes, 0), message: 'Este perfil todavía no se ha preparado.', updatedAt: now(), checkpoint: null, verifiedHash: null } }
  private modelsDirectory() { return this.options.repository.get().modelsDirectory || join(this.options.dataDir, 'models') }
  private storageManager() { return new ModelStorage(this.modelsDirectory(),this.options.repository.get().engineBinding?.directory || null,this.models.flatMap(profile=>this.components(profile).map(component=>({path:this.componentPath(component),bytes:component.bytes,sha256:component.sha256,kind:component.adaptation?'lora' as const:'checkpoint' as const,profile:{id:profile.id,name:profile.model,configurationId:profile.id===this.profile.id?this.configuration.id:configurationsFor(profile)[0].id}})))) }
  private assertStorageMutable() {
    this.assertConfigurationMutable()
    if(this.engine.origin && this.store.jobs(0,10000).some(job=>job.status==='interrupted'&&job.engineUrl===this.engine.origin)) throw new CreationError('Espera a que termine la operación actual.')
  }
  storage() { return this.storageManager().inventory(this.managingFiles || this.startingPrepare || this.activity().preparing || this.activity().jobs>0) }
  async removalPlan(id:string) { this.assertStorageMutable(); try{return await this.storageManager().plan(id)}catch(error){throw new CreationError(error instanceof Error?error.message:'Actualiza la lista de archivos.')} }
  async removeFile(id:string,revision:string,acceptShared:boolean) {
    this.assertStorageMutable(); this.managingFiles=true; this.options.changed('creation')
    try {
      await this.engine.stop()
      const removed=await this.storageManager().remove(id,revision,acceptShared)
      for(const affected of removed.profiles) {
        const profile=this.models.find(item=>item.id===affected.id)!
        const previous=this.store.preparation(profile.id)
        if(previous)this.store.savePreparation({...previous,revision:'',status:'idle',received:0,verifiedHash:null,checkpoint:null,updatedAt:now(),message:'Se retiró un archivo del perfil. Puedes prepararlo de nuevo; tus creaciones se conservan.'})
      }
      this.restorePreparation(); this.options.changed('creation')
      return await this.storageManager().inventory(false)
    } catch(error) { throw new CreationError(error instanceof Error?error.message:'No se pudo retirar el archivo. Actualiza la lista.') }
    finally {this.managingFiles=false;this.options.changed('creation')}
  }
  private components(profile = this.profile): ImageProfile[] { return profile.adaptation ? [this.models.find(model => model.id === profile.adaptation!.base)!, profile] : [profile] }
  private componentPath(profile: ImageProfile) { return join(this.modelsDirectory(), profile.adaptation ? 'loras' : 'checkpoints', profile.filename) }
  private destination() { return this.componentPath(this.profile) }
  private async componentBytes(profile = this.profile) { return Promise.all(this.components(profile).map(async profile => { const destination = this.componentPath(profile); const size = await fileBytes(destination); return { profile, destination, size, received: size === profile.bytes ? size : Math.min(await fileBytes(destination + '.part'), profile.bytes) } })) }

  private revisionFor(profile: ImageProfile, binding = this.options.repository.get().engineBinding) { return digest({ profile: profile.revision, sha256: profile.sha256, bytes: profile.bytes, destination: this.componentPath(profile), adaptation: profile.adaptation, binding }) }
  private revision() { return this.revisionFor(this.profile) }
  private setPreparation(patch: Partial<Preparation>) { this.preparation = { ...this.preparation, ...patch, updatedAt: now() }; this.store.savePreparation(this.preparation); this.options.changed('creation') }
  private saveJob(job: ImageJob) { job.updatedAt = now(); this.store.saveJob(job); this.options.changed('jobs') }
  private async hardware() {
    if (!this.hardwareCache || Date.now() - this.hardwareCache.at > 30000) this.hardwareCache = { value: await (this.options.hardware?.() || detectHardware(this.options.dataDir)), at: Date.now() }
    return this.hardwareCache.value
  }
  private async hardwareKey() {
    const hardware = await this.hardware()
    const binding = this.options.repository.get().engineBinding
    const version = binding ? await readFile(join(binding.directory, 'comfyui_version.py'), 'utf8').catch(() => '') : ''
    return digest({ platform: hardware.platform, arch: hardware.arch, cpu: hardware.cpu.name, ram: hardware.ram.total, gpu: hardware.gpus.map(gpu => [gpu.name, gpu.vramTotal, gpu.driver]), binding, version, profile: this.profile.revision, ...(this.configuration.configuration.parameters.steps === this.profile.steps && this.configuration.configuration.parameters.cfg === 7 ? {} : { configuration: configurationRevision(this.configuration.configuration) }) })
  }
  async discoveryRecommendation() { return recommendImage(await this.hardware()) }
  async state(): Promise<CreationState> {
    const hardware = await this.hardware(), recommendation = recommendImage(hardware,this.profile), evidence = this.store.evidence(this.profile.id)
    const verified = !!evidence && evidence.hardwareKey === await this.hardwareKey()
    const bound = !!this.options.repository.get().engineBinding
    let ready = false
    try { ready = this.preparation.status === 'ready' && this.preparation.revision === this.revision() && this.preparation.verifiedHash === this.profile.sha256 && await fileBytes(this.destination()) === this.profile.bytes }
    catch { this.setPreparation({ status: 'error', message: 'La ubicación del perfil cambió y no se puede comprobar. Elige una carpeta accesible para volver a prepararlo.' }) }
    return creationStateSchema.parse({ configuration: { id: this.configuration.id, name: this.configuration.configuration.name, origin: this.configuration.origin, ...this.configuration.configuration.parameters }, profile: this.profile, recommendation: { ...recommendation, verified, evidenceDetails: verified ? { at: evidence!.at, width: evidence!.width, height: evidence!.height } : null, evidence: verified ? `Primera creación comprobada en este equipo: ${evidence!.width} × ${evidence!.height}, ${new Date(evidence!.at).toLocaleString('es')}.` : null }, preparation: this.preparation, activeJob: this.store.jobs(0, 10000).find(job => !terminal(job)) || null, bound, engineRunning: !!this.engine.origin, canCreate: !this.managingFiles && ready && bound && ['recommended', 'limited'].includes(recommendation.level) })
  }
  async plan(binding = this.options.repository.get().engineBinding): Promise<PreparationPlan> {
    const destination = this.destination()
    const components = await this.componentBytes()
    const total = components.reduce((sum, item) => sum + item.profile.bytes, 0)
    const received = components.reduce((sum, item) => sum + item.received, 0)
    const remaining = total - received, available = await (this.options.disk ? this.options.disk(dirname(destination)) : diskAvailable(dirname(destination))), required = remaining + 512 * 1024 ** 2
    const recommendation = recommendImage(await this.hardware(),this.profile), blockers: string[] = []
    if (!binding) blockers.push('Falta vincular la carpeta y el Python del motor existente en Mi equipo. No se instalará un segundo motor.')
    if (['unknown', 'unsupported'].includes(recommendation.level)) blockers.push(recommendation.reason)
    if (available === null) blockers.push('No se pudo comprobar el espacio de esta ubicación. Elige otra carpeta accesible.')
    else if (available < required) blockers.push('No hay espacio suficiente para la descarga pendiente y el margen de trabajo de 512 MiB.')
    if (components.some(item => item.size && item.size !== item.profile.bytes)) blockers.push('Ya existe un archivo distinto en el destino. Se conserva intacto; elige otra ubicación.')
    return preparationPlanSchema.parse({ revision: this.revisionFor(this.profile, binding), profileId: this.profile.id, destination, totalBytes: total, remainingBytes: remaining, requiredBytes: required, availableBytes: available, canPrepare: blockers.length === 0, blockers, changes: [...components.map(item => `Comprobar o descargar ${item.profile.model}: ${item.profile.bytes} bytes. SHA-256: ${item.profile.sha256}. Fuente: ${item.profile.source}. Licencia: ${item.profile.license} (${item.profile.licenseUrl}).`), 'Reutilizar tu Python y ComfyUI existentes, sin instalar dependencias ni modificar sus modelos.', 'Iniciar un proceso local supervisado con rutas propias de modelos, datos y resultados. No detener otras instancias.', 'Los nodos personalizados permanecen desactivados en este primer perfil. No se generará ninguna imagen hasta pulsar Crear.'], license: this.profile.license, licenseUrl: this.profile.licenseUrl, source: this.profile.source, reuseBytes: received })
  }
  assertConfigurationMutable() { if (this.managingFiles || this.startingPrepare || this.preparationTask || this.generationTask || this.store.jobs(0, 10000).some(job => !terminal(job))) throw new CreationError('Hay una preparación o creación activa. Termínala o cancélala antes de cambiar el motor o la ubicación.') }
  async configurationChanged() { await this.engine.stop(); this.preparation = this.idle(); this.store.savePreparation(this.preparation); this.hardwareCache = null; this.options.changed('creation') }
  async prepare(revision: string): Promise<Preparation> {
    if (this.closing) throw new CreationError('El servicio está cerrando.')
    if (this.preparationTask) { if (revision === this.preparation.revision) return this.preparation; throw new CreationError('Ya hay una preparación activa.') }
    if (this.managingFiles || this.startingPrepare || this.generationTask) throw new CreationError('Espera a que termine la operación actual.')
    this.startingPrepare = true
    try {
      const plan = await this.plan()
      if (revision !== plan.revision) throw new CreationError('El plan cambió. Revisa de nuevo la descarga y su ubicación antes de continuar.')
      if (!plan.canPrepare) throw new CreationError(plan.blockers.join(' '))
      this.store.authorize(revision, { ...plan, sha256: this.profile.sha256, url: this.profile.url, engineBinding: this.options.repository.get().engineBinding })
      const abort = new AbortController(); this.preparationAbort = abort
      this.setPreparation({ id: this.preparation.revision === revision ? this.preparation.id : crypto.randomUUID(), revision, status: 'downloading', received: plan.totalBytes - plan.remainingBytes, total: plan.totalBytes, message: 'Preparando la descarga de tu perfil…', checkpoint: null, verifiedHash: null })
      this.preparationTask = this.runPreparation(abort.signal).finally(() => { this.preparationTask = null; this.preparationAbort = null })
      return this.preparation
    } finally { this.startingPrepare = false }
  }
  private async runPreparation(signal: AbortSignal) {
    try {
      let completed = 0
      const components = await this.componentBytes()
      for (const [index, { profile }] of components.entries()) {
        const preserved = components.slice(index + 1).reduce((sum, item) => sum + item.received, 0)
        const destination = this.componentPath(profile); await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
        if (await fileBytes(destination) !== profile.bytes) await downloadProfileFile(profile, destination, signal, (received, restart) => {
          if (Date.now() - this.preparationProgressAt > 350 || received === profile.bytes || restart) {
            this.preparationProgressAt = Date.now()
            this.setPreparation({ received: completed + received + preserved, message: restart ? 'El origen no admite continuar esta parte; la descarga vuelve a empezar.' : 'Descargando el perfil de imagen…' })
          }
        }, this.options.allowLocalFixture)
        this.setPreparation({ status: 'verifying', message: 'Comprobando la integridad SHA-256 del archivo…' })
        await finishProfileFile(profile, destination, signal)
        completed += profile.bytes
        this.setPreparation({ status: 'downloading', received: completed + preserved })
      }
      this.setPreparation({ verifiedHash: this.profile.sha256, checkpoint: this.profile.filename })
      await this.ensureEngine(signal)
      this.setPreparation({ status: 'ready', message: 'Listo para crear. Tu descripción se conserva; pulsa Crear imagen cuando quieras.' })
    } catch (error) {
      const received = await this.componentBytes().then(items => items.reduce((sum, item) => sum + item.received, 0)).catch(() => 0)
      this.setPreparation({ status: signal.aborted ? 'paused' : 'error', received, message: signal.aborted ? 'Preparación pausada. Se conserva lo descargado; puedes continuar.' : preparationError(error) })
    }
  }
  async pausePreparation() {
    if (this.preparationTask) { this.preparationAbort?.abort(); await this.preparationTask }
    return this.preparation
  }
  private async ensureEngine(signal: AbortSignal) {
    const binding = this.options.repository.get().engineBinding
    if (!binding) throw new CreationError('Falta vincular el motor existente en Mi equipo.')
    if (!this.engine.origin) {
      this.setPreparation({ status: 'starting', message: 'Abriendo el motor existente y comprobando el perfil. No se están instalando componentes.' })
      try { await this.engine.start(binding, this.modelsDirectory(), this.components()[0].filename, signal, this.profile.family==='sdxl'?'lowvram':undefined) }
      catch (error) { this.setPreparation({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo abrir el motor existente.' }); throw error }
      this.setPreparation({ status: 'ready', message: 'El perfil está preparado para crear.' })
    }
      if (this.profile.adaptation) {
        const nodes = await engineJson(this.engine.origin!, '/object_info', undefined, signal)
        if (!nodes.LoraLoader) throw new CreationError('Falta el nodo LoraLoader en este motor. Los archivos se conservan.')
      }
  }
  async create(input: CreateImageInput): Promise<ImageJob> {
    const previous = this.store.byRequest(input.requestId)
    if (previous) {
      if (previous.prompt !== input.prompt || previous.format !== input.format || JSON.stringify(previous.requestedQuality) !== JSON.stringify(input.quality)) throw new CreationError('Ese identificador ya pertenece a otra creación.')
      return previous
    }
    const state = await this.state()
    if (!state.canCreate || this.preparationTask) throw new CreationError('Prepara primero el perfil para crear. La descripción se conserva.')
    if (this.store.jobs(0, 10000).filter(job => !terminal(job)).length >= 10) throw new CreationError('La cola está llena. Espera a que terminen algunas imágenes.')
    // Recheck after async preflight: two clients may send the same id concurrently.
    const raced = this.store.byRequest(input.requestId)
    if (raced) { if (raced.prompt !== input.prompt || raced.format !== input.format || JSON.stringify(raced.requestedQuality) !== JSON.stringify(input.quality)) throw new CreationError('Ese identificador ya pertenece a otra creación.'); return raced }
    const [defaultWidth, defaultHeight] = profileDimensions(input.format,this.profile)
    const quality = input.quality ?? { width: defaultWidth, height: defaultHeight, steps: this.configuration.configuration.parameters.steps, cfg: this.configuration.configuration.parameters.cfg }
    if (!validImageQuality(quality, this.profile)) throw new CreationError('Estos ajustes superan los límites admitidos por Veltria para este modelo. Revisa tamaño, pasos y CFG.', 400)
    const { width, height, steps, cfg } = quality
    const job: ImageJob = { id: crypto.randomUUID(), requestId: input.requestId, prompt: input.prompt, format: input.format, ...(input.quality ? { requestedQuality: input.quality } : {}), profileId: this.profile.id, status: 'queued', seed: randomBytes(4).readUInt32LE(), width, height, configurationId: this.configuration.id, configurationName: this.configuration.configuration.name, configurationOrigin: this.configuration.origin, configurationRevision: configurationRevision(this.configuration.configuration), cfg, sampler: 'euler', scheduler: 'normal', steps, step: null, enginePromptId: null, engineUrl: null, createdAt: now(), updatedAt: now(), message: 'En espera de crear tu imagen.', imageId: null, engineVersion: null, profileRevision: this.profile.revision }
    this.saveJob(job); this.schedule(); return job
  }
  private schedule() {
    if (this.generationTask || this.closing) return
    const job = this.store.jobs(0, 10000).reverse().find(job => job.status === 'queued')
    if (!job) return
    const abort = new AbortController(); this.generationAbort = abort
    this.generationTask = this.runJob(job, abort.signal).finally(() => { this.generationTask = null; this.generationAbort = null; this.schedule() })
  }
  private async runJob(initial: ImageJob, signal: AbortSignal) {
    let job = initial, socket: WebSocket | undefined
    const update = (patch: Partial<ImageJob>) => {
      const saved = this.store.job(job.id)
      if (saved && terminal(saved)) { job = saved; return }
      job = { ...job, ...patch }; this.saveJob(job)
    }
    try {
      update({ message: 'Comprobando el perfil y abriendo tu motor…' })
      await finishProfileFile(this.profile, this.destination(), signal)
      await this.ensureEngine(signal)
      signal.throwIfAborted()
      if (this.store.job(job.id)?.status === 'cancelled') return
      const origin = this.engine.origin!, clientId = crypto.randomUUID()
      const queue = await engineJson(origin, '/queue', undefined, signal)
      if (!Array.isArray(queue.queue_running) || !Array.isArray(queue.queue_pending)) throw new Error('El motor no devolvió una cola válida.')
      socket = new WebSocket(`${origin.replace('http:', 'ws:')}/ws?clientId=${clientId}`)
      socket.onmessage = event => {
        if (typeof event.data !== 'string' || event.data.length > 64000) return
        try {
          const message = JSON.parse(event.data), data = message.data
          if (data?.prompt_id !== job.enginePromptId || terminal(job)) return
          if (message.type === 'progress' && Number.isFinite(data.value) && Number.isFinite(data.max) && data.max > 0) update({ status: 'running', step: Math.min(data.value, data.max), steps: data.max, message: `Creando la imagen · paso ${data.value} de ${data.max}` })
          else if (message.type === 'execution_start') update({ status: 'running', message: 'Cargando el perfil y creando la imagen…' })
          else if (message.type === 'executing' && data.node === '6') update({ message: 'Convirtiendo el resultado en imagen…' })
        } catch { /* a malformed event cannot change persisted job state */ }
      }
      update({ status: 'submitting', enginePromptId: job.id, engineUrl: origin, engineVersion: this.engine.version, message: 'Enviando tu creación al motor…' })
      // Persist the client-chosen prompt id before sending. A lost response must never cause resubmission.
      try {
        const accepted = await engineJson(origin, '/prompt', { prompt_id: job.id, client_id: clientId, prompt: imageWorkflow(this.components()[0].filename, job.prompt, job.width, job.height, job.seed, job.id, job.steps, job.cfg ?? 7, this.profile.adaptation ? { filename: this.profile.filename, strength: this.profile.adaptation.strength } : undefined) }, signal)
        if (accepted.prompt_id !== job.id) throw new Error('El motor no conservó la identidad del trabajo. No se enviará de nuevo automáticamente.')
      } catch (error) {
        update({ status: 'interrupted', message: `No se pudo confirmar el envío. Se conserva su identificador y no se repetirá automáticamente. ${error instanceof Error ? error.message : ''}` }); return
      }
      update({ status: 'running', message: 'El motor aceptó la creación. Cargando el modelo…' })
      const deadline = Date.now() + 30 * 60 * 1000
      while (Date.now() < deadline) {
        signal.throwIfAborted()
        const saved = this.store.job(job.id); if (saved?.status === 'cancelled') return
        const history = await engineJson(origin, `/history/${job.enginePromptId}`, undefined, signal)
        const entry = history[job.enginePromptId!]
        if (entry) {
          if (entry.status?.status_str === 'error' || entry.status?.messages?.some((message: any) => message?.[0] === 'execution_error' || message?.[0] === 'execution_interrupted')) throw new Error('El motor no pudo terminar la imagen. Se conservan la descripción y los ajustes; revisa la memoria disponible antes de volver a crear.')
          const image = entry.outputs?.['7']?.images?.[0]
          if (image && entry.status?.completed !== false) {
            update({ status: 'saving', message: 'Guardando tu imagen en la biblioteca…' })
            const imageId = await this.saveResult(origin, image, job, signal)
            update({ status: 'completed', imageId, step: job.steps, message: 'Imagen creada y guardada en tu biblioteca.' })
            if (job.steps === this.configuration.configuration.parameters.steps && job.cfg === this.configuration.configuration.parameters.cfg) this.store.saveEvidence(this.profile.id, { hardwareKey: await this.hardwareKey(), engineVersion: this.engine.version || 'no informada', width: job.width, height: job.height, at: now() })
            this.options.changed('creation'); return
          }
        }
        await pause(1000, signal)
      }
      update({ status: 'interrupted', message: 'La espera superó treinta minutos. El trabajo no se repetirá automáticamente; puedes consultar su estado o cancelarlo.' })
    } catch (error) {
      const saved = this.store.job(job.id)
      if (saved && !terminal(saved)) update({ status: signal.aborted ? 'interrupted' : 'failed', message: signal.aborted ? 'La creación se interrumpió. Se conserva la descripción y no se repetirá automáticamente.' : error instanceof Error ? error.message : 'No se pudo crear la imagen. La descripción se conserva.' })
    } finally { socket?.close() }
  }
  private async saveResult(origin: string, image: any, job: ImageJob, signal: AbortSignal) {
    const filename = image?.filename, subfolder = image?.subfolder || ''
    if (typeof filename !== 'string' || !filename.startsWith(`veltria_${job.id}_`) || !/^[A-Za-z0-9_.-]+\.png$/.test(filename) || image.type !== 'output' || typeof subfolder !== 'string' || subfolder.includes('..') || /[\\:\x00]/.test(subfolder) || subfolder.startsWith('/')) throw new Error('El motor devolvió una referencia de imagen no admitida.')
    const response = await fetch(`${origin}/view?${new URLSearchParams({ filename, subfolder, type: 'output' })}`, { signal, redirect: 'error' })
    if (!response.ok || !response.body) throw new Error('No se pudo recuperar la imagen del motor. El resultado original se conserva en su carpeta de salida.')
    const imageId = job.id, directory = join(this.options.dataDir, 'creations'); await mkdir(directory, { recursive: true, mode: 0o700 })
    const temporary = join(directory, `${imageId}.${crypto.randomUUID()}.png.part`), final = join(directory, `${imageId}.png`)
    const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = []
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 24 * 1024 * 1024) throw new Error('El resultado excede el tamaño admitido. Se conserva en el motor.'); chunks.push(value) }
    } finally { await reader.cancel().catch(() => {}) }
    const content = Buffer.concat(chunks)
    if (content.length < 24 || content.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || content.readUInt32BE(16) !== job.width || content.readUInt32BE(20) !== job.height) throw new Error('El motor no devolvió un PNG con las dimensiones solicitadas.')
    signal.throwIfAborted()
    if (await fileBytes(final)) {
      const previous = await readFile(final)
      if (!previous.equals(content)) throw new Error('Ya existe un resultado distinto para este trabajo. Se conserva intacto.')
      return imageId
    }
    await writeFile(temporary, content, { mode: 0o600, flag: 'wx' }); await rename(temporary, final)
    return imageId
  }
  async cancel(id: string): Promise<ImageJob> {
    const job = this.store.job(id)
    if (!job) throw new CreationError('No se encontró esa creación.', 404)
    if (terminal(job) && job.status !== 'interrupted') return job
    if (job.status === 'submitting') throw new CreationError('El motor está confirmando el envío. Espera un momento para cancelar ese trabajo con seguridad.')
    if (job.status === 'saving') throw new CreationError('La imagen ya se está guardando. Espera a que aparezca en la biblioteca.')
    if (job.enginePromptId && job.engineUrl) {
      if (job.engineUrl !== this.engine.origin) throw new CreationError('No se puede confirmar el motor de este trabajo. No se cancelará ningún otro proceso.')
      await engineJson(job.engineUrl, `/api/jobs/${job.enginePromptId}/cancel`, {})
    }
    const latest = this.store.job(id); if (latest && terminal(latest) && latest.status !== 'interrupted') return latest
    const cancelled: ImageJob = { ...job, status: 'cancelled', message: 'Creación cancelada. Tu descripción y ajustes se conservan.' }
    this.saveJob(cancelled); return cancelled
  }
  async reconcile(id: string): Promise<ImageJob> {
    const job = this.store.job(id)
    if (!job || !job.enginePromptId || !job.engineUrl || job.status !== 'interrupted') throw new CreationError('Esta creación no tiene un envío pendiente de comprobar.')
    const local = join(this.options.dataDir, 'creations', `${job.id}.png`)
    if (await fileBytes(local)) {
      const content = await readFile(local)
      if (content.length >= 24 && content.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && content.readUInt32BE(16) === job.width && content.readUInt32BE(20) === job.height) {
        const recovered = { ...job, status: 'completed' as const, imageId: job.id, message: 'Imagen recuperada del disco sin repetir la generación.' }; this.saveJob(recovered); return recovered
      }
    }
    // Only query the stored local origin. Never resubmit an interrupted generation.
    const history = await engineJson(job.engineUrl, `/history/${job.enginePromptId}`)
    const entry = history[job.enginePromptId]
    if (!entry?.outputs?.['7']?.images?.[0] || entry.status?.status_str === 'error') throw new CreationError('Todavía no hay un resultado recuperable en ese motor. Puedes iniciar otra creación expresamente.')
    const imageId = await this.saveResult(job.engineUrl, entry.outputs['7'].images[0], job, new AbortController().signal)
    const recovered = { ...job, status: 'completed' as const, imageId, message: 'Imagen recuperada del motor sin repetir la generación.' }; this.saveJob(recovered); return recovered
  }
  artifact(id: string) {
    const job = this.store.job(id)
    if (!job || job.status !== 'completed' || job.imageId !== id) throw new CreationError('No se encontró esa imagen en la biblioteca.', 404)
    return join(this.options.dataDir, 'creations', `${id}.png`)
  }
  activity() { return { preparing: !!this.preparationTask, jobs: this.store.jobs(0, 10000).filter(job => !terminal(job)).length } }
  async releaseEngine() { this.assertConfigurationMutable(); await this.engine.stop() }
  async close() {
    this.closing = true; this.preparationAbort?.abort(); this.generationAbort?.abort()
    await this.engine.stop()
    await Promise.allSettled([this.preparationTask, this.generationTask].filter(Boolean))
    for (const job of this.store.jobs(0, 10000)) if (!terminal(job)) this.saveJob({ ...job, status: 'interrupted', message: 'El servicio se cerró. Se conserva la descripción; no se repetirá la generación automáticamente.' })
  }
}
