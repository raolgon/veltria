import { createHash } from 'node:crypto'
import { isAbsolute } from 'node:path'
import type { Settings, SetupPlan, SetupState, Installation } from '@veltria/contracts'
import { discoverEngines, installationFingerprint, type DiscoveryResult } from '../../../packages/adapters/src/engine-discovery'
import { validateEngineBinding } from '../../../packages/adapters/src/image-engine'
import { CreationError, type CreationController } from './creation'
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export type SetupOptions = {
  settings: () => Settings; creation: CreationController; changed: () => void;
  discover?: (binding: Settings['engineBinding'], directory: string | undefined, signal: AbortSignal) => Promise<DiscoveryResult>
}
export class SetupController {
  private value: SetupState = { scanId: null, status: 'idle', installations: [], notes: [], message: 'Puedes buscar una instalación existente para preparar tu equipo.', checkedAt: null }
  private task: Promise<void> | null = null
  private abort = new AbortController()
  private directory: string | undefined
  private reviews = new Map<string, { installationId: string; scanId: string; at: number }>()
  constructor(private options: SetupOptions) {}
  state() { return this.value }
  scan(directory?: string) {
    if (directory && (!isAbsolute(directory) || directory.includes('\0'))) throw new CreationError('Selecciona una carpeta absoluta del equipo que ejecuta Veltria.', 400)
    if (this.task) { if (directory === this.directory) return this.value; throw new CreationError('Ya hay una búsqueda en curso. Espera a que termine.') }
    this.directory = directory; this.reviews.clear()
    this.value = { scanId: crypto.randomUUID(), status: 'scanning', installations: [], notes: [], checkedAt: null, message: 'Buscando herramientas existentes en tu equipo…' }
    this.options.changed()
    const binding = this.options.settings().engineBinding
    this.task = (async () => {
      try {
        const result = await (this.options.discover ? this.options.discover(binding, directory, this.abort.signal) : discoverEngines(binding, directory, { signal: this.abort.signal }))
        this.value = { ...this.value, ...result, status: 'complete', checkedAt: new Date().toISOString(), message: result.installations.some(item => item.available) ? 'Encontramos una instalación que puedes reutilizar.' : 'No se confirmó una instalación utilizable en las ubicaciones revisadas. Puedes elegir una carpeta.' }
      } catch { this.value = { ...this.value, status: 'error', message: 'No se pudo completar la búsqueda. Vuelve a intentarlo o elige una carpeta.' } }
      finally { this.task = null; if (!this.abort.signal.aborted) this.options.changed() }
    })()
    return this.value
  }
  private installation(scanId: string, id: string) {
    if (this.value.status !== 'complete' || this.value.scanId !== scanId) throw new CreationError('La búsqueda cambió. Revisa de nuevo la propuesta para tu equipo.')
    const candidate = this.value.installations.find(item => item.id === id)
    if (!candidate?.available || !candidate.python) throw new CreationError('Elige una instalación utilizable de la búsqueda actual.')
    return candidate as Installation & { python: string }
  }
  async plan(scanId: string, installationId: string): Promise<SetupPlan> {
    const candidate = this.installation(scanId, installationId)
    const binding = await validateEngineBinding({ directory: candidate.directory, python: candidate.python }).catch(() => { throw new CreationError('La instalación cambió o dejó de estar accesible. Vuelve a buscarla.') })
    const fingerprint = await installationFingerprint(binding).catch(() => { throw new CreationError('No se pudo comprobar la instalación. Vuelve a buscarla o elige otra carpeta.') })
    const preparation = await this.options.creation.plan(binding), state = await this.options.creation.state(), settings = this.options.settings()
    const revision = digest({ scanId, installationId, fingerprint, preparation: preparation.revision, configurationId: state.configuration.id, previous: { binding: settings.engineBinding, modelsDirectory: settings.modelsDirectory } })
    this.installation(scanId, installationId)
    this.reviews.set(revision, { installationId, scanId, at: Date.now() })
    // Bound ephemeral review state even if several authorized clients inspect different options.
    for (const [key, review] of this.reviews) if (Date.now() - review.at > 10 * 60_000) this.reviews.delete(key)
    while (this.reviews.size > 32) this.reviews.delete(this.reviews.keys().next().value!)
    return { revision, scanId, installation: { ...candidate, ...binding }, profile: state.profile, configurationId: state.configuration.id, configuration: state.configuration, recommendation: JSON.stringify(settings.engineBinding) === JSON.stringify(binding) ? state.recommendation : { ...state.recommendation, verified: false, evidence: null, evidenceDetails: null }, preparation }
  }
  async review(revision: string) {
    const previous = this.reviews.get(revision)
    if (!previous || Date.now() - previous.at > 10 * 60_000) throw new CreationError('La propuesta venció. Revisa de nuevo la preparación de tu equipo.')
    const current = await this.plan(previous.scanId, previous.installationId)
    if (current.revision !== revision) throw new CreationError('La propuesta cambió. Revisa de nuevo la preparación antes de continuar.')
    if (!current.preparation.canPrepare) throw new CreationError(current.preparation.blockers.join(' '))
    return current
  }
  async close() { this.abort.abort(); await this.task }
}
