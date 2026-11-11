import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, lstat, stat, realpath, statfs, writeFile } from 'node:fs/promises'
import { join, resolve, dirname, isAbsolute } from 'node:path'
import { managedStateSchema, type ManagedState, type ManagedPlan, type Settings } from '@veltria/contracts'
import type { SettingsRepository } from '@veltria/adapters'
import linux from '../../../packages/core/src/managed/linux.json'
import windows from '../../../packages/core/src/managed/win.json'
import { downloadProfileFile, finishProfileFile, fileBytes } from '../../../packages/adapters/src/profile-download'
import { validateEngineBinding } from '../../../packages/adapters/src/image-engine'
import { CreationError, type CreationController } from './creation'
import type { SetupController } from './setup'
import { storageBudget, dataStorageError, storageFailure, storagePermission, probeStorageWrite } from './storage-issues'

const execute = promisify(execFile)
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
type Artifact = { filename: string; url: string; bytes: number; sha256: string }
export type ManagedRecipe = typeof linux
const active = (s: ManagedState) => ['downloading', 'installing', 'preparing'].includes(s.status)
function installationFailure(error: unknown) {
  const detail = error instanceof Error ? error.message : ''
  const code = (error as NodeJS.ErrnoException | null)?.code
  if (code === 'ENOSPC' || /ENOSPC|no space|disk full|not enough space/i.test(detail)) return 'Se agotó el espacio. Libera espacio o elige otra ubicación y revisa el plan para continuar; se conservan los archivos.'
  if (code === 'EACCES' || code === 'EPERM' || /permission denied|access is denied|operation not permitted|read-only file system/i.test(detail)) return 'No se puede escribir o ejecutar en esta ubicación. Revisa sus permisos o elige otra carpeta y vuelve a revisar el plan; se conservan los archivos.'
  return 'No se pudo completar la instalación. Revisa el plan para continuar. ' + detail
}
export type ManagedOptions = {
  dataDir: string; repository: SettingsRepository; creation: CreationController; setup: SetupController; changed: () => void;
  // Only server-side dependency injection for tests; no API accepts manifests or commands.
  recipe?: ManagedRecipe; allowLocalFixture?: boolean; disk?: () => Promise<number>;
  install?: (root: string, signal: AbortSignal) => Promise<NonNullable<Settings['engineBinding']>>;
}
export class ManagedController {
  private value: ManagedState
  private task: Promise<void> | null = null
  private abort: AbortController | null = null
  private review: { revision: string; at: number } | null = null
  private recipe: ManagedRecipe
  private root: string
  private lastProgress = 0
  private separateInstallation = false
  constructor(private options: ManagedOptions) {
    this.recipe = options.recipe || (process.platform === 'win32' ? windows : linux)
    this.root = join(options.dataDir, 'managed', this.recipe.id)
    options.repository.db.exec('CREATE TABLE IF NOT EXISTS managed_setup (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)')
    options.repository.db.exec('CREATE TABLE IF NOT EXISTS managed_location (id INTEGER PRIMARY KEY CHECK(id=1), directory TEXT NOT NULL)')
    const location = options.repository.db.query('SELECT directory FROM managed_location WHERE id=1').get() as { directory: string } | null
    if (location) this.root = location.directory
    const row = options.repository.db.query('SELECT data FROM managed_setup WHERE id=1').get() as { data: string } | null
    this.value = row ? managedStateSchema.parse(JSON.parse(row.data)) : { status: 'idle', message: 'Revisa la instalación antes de preparar tu equipo.', received: 0, total: 0, revision: '', updatedAt: new Date().toISOString() }
    if (active(this.value)) this.set({ status: 'paused', message: 'La instalación se interrumpió. Revisa el plan para continuar con los archivos conservados.' })
  }
  state() { return this.value }
  busy() { return !!this.task }
  private set(patch: Partial<ManagedState>) {
    this.value = { ...this.value, ...patch, updatedAt: new Date().toISOString() }
    try { this.options.repository.db.query('INSERT OR REPLACE INTO managed_setup VALUES (1,?)').run(JSON.stringify(this.value)) } catch (error) { dataStorageError(error, this.options.dataDir) }
    this.options.changed()
  }
  private artifacts(): Artifact[] { return [this.recipe.python, this.recipe.uv, this.recipe.comfy, ...this.recipe.wheels] }
  private binding() { return { directory: join(this.root, 'ComfyUI-0.35.0'), python: join(this.root, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3') } }
  private async safeRoot(create = false) {
    // Refuse redirected parent directories. This installer never traverses external environments.
    const paths: string[] = []
    for (let p = join(this.root, 'downloads');; p = dirname(p)) { paths.unshift(p); if (dirname(p) === p) break }
    for (const path of paths) {
      try {
        const entry = await lstat(path)
        const normalize = (p: string) => process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p)
        if (!entry.isDirectory() || entry.isSymbolicLink() || normalize(await realpath(path)) !== normalize(path)) throw new CreationError('La ubicación de instalación contiene un enlace. Usa un directorio de datos local sin enlaces.')
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    }
    if (create) await mkdir(join(this.root, 'downloads'), { recursive: true, mode: 0o700 })
  }
  async plan(directory?: string, allowSeparateInstallation?: boolean): Promise<ManagedPlan> {
    if (this.busy()) throw new CreationError('Espera a que termine la operación actual.')
    if (allowSeparateInstallation !== undefined && allowSeparateInstallation !== this.separateInstallation) {
      this.separateInstallation = allowSeparateInstallation; this.review = null
    }
    if (directory !== undefined) {
      if (!isAbsolute(directory) || directory.includes('\0')) throw new CreationError('Selecciona una carpeta absoluta para el entorno de Veltria.', 400)
      this.root = join(resolve(directory), 'Veltria-managed', this.recipe.id)
      this.review = null
    }
    const storageIssues = [] as NonNullable<ManagedPlan['storageIssues']>
    try { await this.safeRoot() } catch (error) {
      const issue = storageFailure(error, this.root, 'environment'); if (!issue) throw error; storageIssues.push(issue)
    }
    const permission = await storagePermission(this.root, 'environment')
    if (permission) storageIssues.push(permission)
    const dataPermission = await storagePermission(this.options.dataDir, 'data')
    if (dataPermission) storageIssues.push(dataPermission)
    const dataDisk = await statfs(this.options.dataDir).catch(() => null)
    storageIssues.push(...storageBudget(this.options.dataDir, 'data', 16 * 1024 ** 2, dataDisk ? dataDisk.bavail * dataDisk.bsize : null))
    const preparation = await this.options.creation.plan(this.binding())
    const blockers = [...preparation.blockers]
    const scan = this.options.setup.state()
    if (scan.status !== 'complete') blockers.push('Busca primero las instalaciones existentes antes de instalar otro motor.')
    if (!this.separateInstallation && scan.installations.some(i => i.available) && this.options.repository.get().engineBinding?.directory !== this.binding().directory) blockers.push('Hay una instalación utilizable. Reutilízala para evitar duplicar el motor.')
    if (!this.options.recipe && (process.arch !== 'x64' || !['linux', 'win32'].includes(process.platform))) blockers.push('La instalación administrada sólo admite Windows y Linux x64.')
    const artifacts = this.artifacts(), total = artifacts.reduce((n, a) => n + a.bytes, 0)
    let received = 0
    for (const a of artifacts) {
      const path = join(this.root, 'downloads', a.filename)
      let size = 0, partial = 0
      try { size = await fileBytes(path); partial = await fileBytes(path + '.part') } catch (error) {
        const issue = storageFailure(error, this.root, 'environment'); if (!issue) throw error
        if (!storageIssues.some(item => item.code === issue.code)) storageIssues.push(issue)
      }
      if (size && size !== a.bytes) blockers.push('Hay un archivo distinto en el destino. Se conserva intacto; revisa la ubicación de instalación.')
      received += size === a.bytes ? size : Math.min(partial, a.bytes)
    }
    const remaining = total - received
    // Compressed downloads are retained for repair; reserve installation, cache and temporary copies.
    const required = remaining + total * 3 + 2 * 1024 ** 3
    const diskAt = async (destination: string) => {
      for (let path = destination;; path = dirname(path)) {
        try { const [s, entry] = await Promise.all([statfs(path), stat(path)]); return { available: s.bavail * s.bsize, device: entry.dev } }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(path) === path) throw error }
      }
    }
    const environmentDisk = await diskAt(this.root).catch(() => null)
    const modelDisk = await diskAt(preparation.destination).catch(() => null)
    const disk = this.options.disk ? await this.options.disk().catch(() => null) : environmentDisk?.available ?? null
    const sharedDisk = !!this.options.disk || !environmentDisk || !modelDisk || environmentDisk.device === modelDisk.device
    storageIssues.push(...storageBudget(this.root, 'environment', required + (sharedDisk ? preparation.requiredBytes : 0), disk), ...(preparation.storageIssues || []))
    blockers.push(...storageIssues.filter(issue => issue.severity === 'error').map(issue => issue.message).filter(message => !blockers.includes(message)))
    const revision = digest({ recipe: this.recipe, root: this.root, preparation: preparation.revision, configuration: (await this.options.creation.state()).configuration, binding: this.options.repository.get().engineBinding, separateInstallation: this.separateInstallation })
    this.review = { revision, at: Date.now() }
    const sources = ['https://github.com/Comfy-Org/ComfyUI/tree/v0.35.0', 'https://github.com/astral-sh/python-build-standalone', 'https://github.com/astral-sh/uv', 'https://pypi.org']
    if (artifacts.some(a => ['download.pytorch.org', 'download-r2.pytorch.org'].includes(new URL(a.url).hostname))) sources.push('https://download.pytorch.org/whl/cu126')
    return { storageIssues, revision, recipe: this.recipe.id, directory: this.root, model: this.options.creation.profile.model, configuration: (await this.options.creation.state()).configuration.name, remainingBytes: remaining, totalBytes: total, requiredBytes: required, availableBytes: disk, canPrepare: !blockers.length, blockers, sources, separateInstallation: this.separateInstallation, licenses: this.recipe.licenses, preparation }
  }
  async start(revision: string) {
    if (this.busy()) { if (revision === this.value.revision) return this.value; throw new CreationError('Espera a que termine la operación actual.') }
    if (!this.review || this.review.revision !== revision || Date.now() - this.review.at > 10 * 60_000) throw new CreationError('La propuesta venció. Revisa de nuevo la instalación antes de continuar.')
    this.options.creation.assertConfigurationMutable()
    const plan = await this.plan()
    if (revision !== plan.revision) throw new CreationError('La propuesta cambió. Revisa de nuevo la instalación antes de continuar.')
    if (!plan.canPrepare) throw new CreationError(plan.blockers.join(' '))
    await this.options.creation.releaseEngine()
    // Store the complete authorized recipe and model plan before any network or executable action.
    try {
      this.options.repository.db.exec('CREATE TABLE IF NOT EXISTS managed_authorizations (revision TEXT PRIMARY KEY, data TEXT NOT NULL)')
      this.options.repository.db.query('INSERT OR REPLACE INTO managed_authorizations VALUES (?,?)').run(revision, JSON.stringify({ plan, recipe: this.recipe, at: new Date().toISOString() }))
      this.options.repository.db.query('INSERT OR REPLACE INTO managed_location VALUES (1,?)').run(this.root)
      this.abort = new AbortController()
      this.set({ revision, storageIssue: null, status: 'downloading', total: plan.totalBytes, received: plan.totalBytes - plan.remainingBytes, message: 'Descargando el entorno aislado. Puedes pausar y continuar.' })
    } catch (error) {
      this.abort = null
      const issue = storageFailure(error, this.options.dataDir, 'data')
      if (!issue) throw error
      this.value = { ...this.value, status: 'error', storageIssue: issue, message: issue.message, updatedAt: new Date().toISOString() }
      this.options.changed(); throw new CreationError(issue.message)
    }
    this.task = this.run(this.abort!.signal).finally(() => { this.task = null; this.abort = null; this.options.changed() })
    return this.value
  }
  private async run(signal: AbortSignal) {
    let modelIssue: ManagedState['storageIssue'] = null
    try {
      await this.safeRoot(true)
      await probeStorageWrite(join(this.root, 'downloads'), signal)
      let completed = 0
      const artifacts = this.artifacts()
      const retained = await Promise.all(artifacts.map(async a => {
        const path = join(this.root, 'downloads', a.filename)
        return await fileBytes(path) === a.bytes ? a.bytes : Math.min(await fileBytes(path + '.part'), a.bytes)
      }))
      for (const [index, a] of artifacts.entries()) {
        const preserved = retained.slice(index + 1).reduce((sum, n) => sum + n, 0)
        signal.throwIfAborted()
        const path = join(this.root, 'downloads', a.filename)
        if (await fileBytes(path) !== a.bytes) await downloadProfileFile(a, path, signal, bytes => {
          if (Date.now() - this.lastProgress > 500 || bytes === a.bytes) { this.lastProgress = Date.now(); this.set({ received: completed + bytes + preserved }) }
        }, this.options.allowLocalFixture, ['github.com', 'release-assets.githubusercontent.com', 'codeload.github.com', 'files.pythonhosted.org', 'download.pytorch.org', 'download-r2.pytorch.org'])
        await finishProfileFile(a, path, signal)
        completed += a.bytes; this.set({ received: completed + preserved })
      }
      this.set({ status: 'installing', message: 'Instalando Python y dependencias en el entorno de Veltria…' })
      const binding = this.options.install ? await this.options.install(this.root, signal) : await this.install(signal)
      signal.throwIfAborted()
      this.options.repository.update({ engineBinding: binding })
      await this.options.creation.configurationChanged()
      this.set({ status: 'preparing', message: 'Preparando el modelo y comprobando el motor…' })
      const plan = await this.options.creation.plan()
      modelIssue = plan.storageIssues?.find(issue => issue.severity === 'error') || null
      await this.options.creation.prepare(plan.revision)
      while (true) {
        signal.throwIfAborted()
        const state = await this.options.creation.state()
        if (state.canCreate) break
        if (['error', 'paused'].includes(state.preparation.status)) throw new Error(state.preparation.message)
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      this.set({ status: 'ready', message: 'Tu equipo está preparado. Ya puedes crear tu imagen.' })
    } catch (error) {
      const issue = signal.aborted ? null : modelIssue || (this.value.status === 'preparing' ? (await this.options.creation.state()).preparation.storageIssue : null) || storageFailure(error, this.root, 'environment')
      if (signal.aborted) await this.options.creation.pausePreparation()
      try {
        this.set({ status: signal.aborted ? 'paused' : 'error', storageIssue: issue, message: signal.aborted ? 'Instalación pausada. Revisa el plan para continuar con los archivos conservados.' : issue?.message || installationFailure(error) })
      } catch (error) {
        const dataIssue = storageFailure(error, this.options.dataDir, 'data')
        if (dataIssue) this.value = { ...this.value, storageIssue: dataIssue, message: dataIssue.message }
        // A full/read-only data disk may also reject SQLite's error update. Keep the
        // in-memory error visible; the last persisted active state recovers as paused.
        this.options.changed()
      }
    }
  }
  private async install(signal: AbortSignal) {
    const run = async (file: string, args: string[]) => {
      await execute(file, args, { cwd: this.root, shell: false, signal, timeout: 30 * 60_000, maxBuffer: 4 * 1024 ** 2,
        env: { ...process.env, PYTHONPATH: '', PYTHONHOME: '', PYTHONNOUSERSITE: '1', UV_NO_CONFIG: '1', UV_PYTHON_DOWNLOADS: 'never', UV_CACHE_DIR: join(this.root, 'cache') } })
    }
    // All archives are release-pinned and fully hashed before extraction. No user archives accepted.
    this.set({ message: 'Preparando los archivos del entorno…' })
    for (const artifact of [this.recipe.python, this.recipe.uv, this.recipe.comfy]) await run(process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : '/usr/bin/tar', ['-xf', join(this.root, 'downloads', artifact.filename), '-C', this.root])
    const binding = await validateEngineBinding(this.binding())
    const uv = join(this.root, process.platform === 'win32' ? 'uv.exe' : 'uv-x86_64-unknown-linux-gnu/uv')
    const requirements = join(this.root, 'requirements.lock')
    await writeFile(requirements, this.recipe.requirements, { mode: 0o600 })
    // Offline, binary-only installation from the previously reviewed and verified wheel set.
    this.set({ message: 'Instalando los componentes del entorno…' })
    await run(uv, ['pip', 'sync', '--python', binding.python, '--offline', '--no-index', '--find-links', join(this.root, 'downloads'), '--require-hashes', '--only-binary', ':all:', '--link-mode', 'copy', '--strict', requirements])
    // This image recipe uses eager PyTorch. Optional Triton kernels need a host C compiler;
    // disable their import in our own interpreter instead of installing system build tools.
    // Comfy Kitchen catches ImportError and uses its eager/CUDA backends. External Python is untouched.
    const site = join(this.root, 'python', process.platform === 'win32' ? 'Lib/site-packages' : 'lib/python3.12/site-packages')
    await writeFile(join(site, 'sitecustomize.py'), '# Veltria image recipe: no optional JIT compiler dependency.\nimport sys\nsys.modules["triton"] = None\n', { mode: 0o600 })
    this.set({ message: 'Comprobando la aceleración del equipo…' })
    await run(binding.python, ['-I', '-c', 'import torch, torchvision, torchaudio, aiohttp, safetensors, comfy_kitchen; assert torch.cuda.is_available(), "CUDA no está disponible; comprueba el controlador NVIDIA"'])
    return binding
  }
  async pause() { this.abort?.abort(); await this.task; return this.value }
  async close() { await this.pause() }
}
