import type { Catalog, CreationState, DiscoveryResult, Hardware, ImageQuality, SetupPlan } from '@veltria/contracts'

type Model = Catalog['models'][number]
type Recommendation = Model['recommendation']

export function primaryGpu(hardware: Hardware | null | undefined) {
  if (!hardware?.gpus.length) return null
  return hardware.gpus.find(gpu => /nvidia/i.test(gpu.name) && gpu.vramTotal !== null)
    ?? hardware.gpus.find(gpu => gpu.vramTotal !== null)
    ?? hardware.gpus[0]
    ?? null
}

export function defaultChoice(modelId: string, catalog: Catalog) {
  return catalog.selectedModelId === modelId
    ? catalog.selectedConfigurationId
    : (catalog.configurations.find(entry => entry.configuration.modelId === modelId)?.id || '')
}

export function verifiedChoice(item: Model, choice: string, catalog: Catalog) {
  const configuration = catalog.configurations.find(entry => entry.id === choice)?.configuration
  const size = startingSize(configuration?.parameters.format, item.profile.family)
  const evidence = item.recommendation.evidenceDetails
  return !!evidence && evidence.width === size[0] && evidence.height === size[1] && item.recommendation.verified && catalog.selectedModelId === item.profile.id && catalog.selectedConfigurationId === choice
}

export function compatibilityRank(level: Recommendation['level']) {
  return { recommended: 0, limited: 1, unknown: 2, unsupported: 3 }[level]
}

export function localPriority(item: Model, choice: string, catalog: Catalog) {
  if (['unsupported', 'unknown'].includes(item.recommendation.level)) return 5
  if (verifiedChoice(item, choice, catalog)) return 0
  return { prepared: 1, downloaded: 2, partial: 3, missing: 4 }[item.status]
}

export function compareLocalModels(a: Model, b: Model, catalog: Catalog, choiceFor?: (modelId: string) => string) {
  const choiceA = choiceFor ? choiceFor(a.profile.id) : defaultChoice(a.profile.id, catalog)
  const choiceB = choiceFor ? choiceFor(b.profile.id) : defaultChoice(b.profile.id, catalog)
  return localPriority(a, choiceA, catalog) - localPriority(b, choiceB, catalog)
    || compatibilityRank(a.recommendation.level) - compatibilityRank(b.recommendation.level)
}

export function rankWelcomeModels(catalog: Catalog | null) {
  if (!catalog) return []
  return catalog.models
    .filter(item => !item.profile.adaptation)
    .sort((a, b) => compareLocalModels(a, b, catalog))
}

export function selectWelcomeModels(catalog: Catalog | null, preferSelected = false) {
  const choices = rankWelcomeModels(catalog)
  if (!catalog || !choices.length) return { choices, primary: undefined, alternative: undefined }
  const selected = choices.find(item => item.profile.id === catalog.selectedModelId)
  const top = choices[0]
  const primary = preferSelected && selected
    ? selected
    : selected && compareLocalModels(selected, top, catalog) <= 0
      ? selected
      : top
  const alternative = choices.find(item => item.profile.id !== primary.profile.id)
  return { choices, primary, alternative }
}

export function purpose(id: string, adaptation: boolean) {
  if (adaptation) return 'Para adaptar un estilo, personaje o efecto sobre un modelo base.'
  if (id === 'sdxl-base') return 'Para explorar SDXL con ajustes conservadores para 6 GB.'
  if (id === 'dreamshaper-8') return 'Para explorar ilustración y estilos artísticos.'
  if (id === 'sd15-starter') return 'Para empezar con imágenes de uso general.'
  return 'Modelo de la comunidad. Revisa los ejemplos y la descripción del autor para conocer su especialidad.'
}

export function matchingLocalModel(item: DiscoveryResult, catalog: Catalog | null) {
  return catalog?.models.find(model => model.profile.source === item.source && !model.profile.adaptation)
}

export function remotePriority(item: DiscoveryResult, catalog: Catalog | null) {
  if (!item.supported) return 5
  const existing = matchingLocalModel(item, catalog)
  return existing ? localPriority(existing, defaultChoice(existing.profile.id, catalog!), catalog!) : 4
}

export function remoteRecommendationState(
  item: DiscoveryResult,
  catalog: Catalog | null,
  fallback: Pick<CreationState, 'recommendation'> | null
): Pick<CreationState, 'recommendation'> | null {
  const existing = matchingLocalModel(item, catalog)
  if (existing) return { recommendation: existing.recommendation }
  const familyModel = item.family === 'SDXL'
    ? catalog?.models.find(model => model.profile.family === 'sdxl')
    : catalog?.models.find(model => model.profile.id === 'sd15-starter')
  return familyModel ? { recommendation: familyModel.recommendation } : fallback
}

export function availabilityLabel(status: Model['status']) {
  return {
    missing: 'Sin descargar',
    partial: 'Descarga parcial',
    downloaded: 'Descargado · falta comprobar',
    prepared: 'Preparado para crear'
  }[status]
}

export function creationAvailabilityLabel(state: Pick<CreationState, 'preparation' | 'canCreate'>) {
  if (state.canCreate || state.preparation.status === 'ready') return availabilityLabel('prepared')
  if (['downloading', 'verifying', 'starting'].includes(state.preparation.status)) return 'Preparación en curso'
  if (state.preparation.total > 0 && state.preparation.received >= state.preparation.total) return availabilityLabel('downloaded')
  if (state.preparation.received > 0) return availabilityLabel('partial')
  return availabilityLabel('missing')
}

export function setupPlanAvailabilityLabel(plan: Pick<SetupPlan, 'profile' | 'preparation'>, catalog: Catalog | null) {
  const existing = catalog?.models.find(model => model.profile.id === plan.profile.id)
  if (existing) return availabilityLabel(existing.status)
  if (plan.preparation.remainingBytes === 0) return availabilityLabel('downloaded')
  if (plan.preparation.reuseBytes > 0) return availabilityLabel('partial')
  return availabilityLabel('missing')
}

export function suitability(state: Pick<CreationState, 'recommendation'> | null) {
  if (!state) return 'Compatibilidad por revisar'
  if (state.recommendation.level === 'unsupported') return 'No admitido en este equipo'
  if (state.recommendation.level === 'unknown') return 'Compatibilidad sin confirmar'
  if (state.recommendation.reason.startsWith('SDXL ')) {
    if (state.recommendation.reason.includes('no se pudo leer la memoria RAM libre')) return 'Con ajustes de memoria · memoria libre sin confirmar'
    if (state.recommendation.reason.includes('queda poca memoria libre')) return 'Con ajustes de memoria · poca memoria libre'
    return 'Con ajustes de memoria · ejecución por comprobar'
  }
  if (state.recommendation.reason.includes('no se pudo leer la memoria RAM libre')) return 'Cumple los mínimos · memoria libre sin confirmar'
  return state.recommendation.level === 'limited'
    ? 'Cumple los mínimos · memoria libre limitada'
    : 'Compatible estimado · falta probar esta configuración'
}

export function modelEvidenceLabel(item: Model, choice: string, catalog: Catalog) {
  if (verifiedChoice(item, choice, catalog)) return 'Comprobado con los ajustes elegidos'
  return suitability(item)
}

export function setupPlanEvidenceLabel(plan: Pick<SetupPlan, 'profile' | 'configurationId' | 'recommendation'>, catalog: Catalog | null) {
  const existing = catalog?.models.find(model => model.profile.id === plan.profile.id)
  if (existing && catalog) return modelEvidenceLabel(existing, plan.configurationId, catalog)
  return suitability({ recommendation: plan.recommendation })
}

export function remoteEvidenceLabel(
  item: DiscoveryResult,
  catalog: Catalog | null,
  fallback: Pick<CreationState, 'recommendation'> | null
) {
  if (!item.supported) return 'Compatibilidad por revisar'
  const existing = matchingLocalModel(item, catalog)
  if (existing && catalog) return modelEvidenceLabel(existing, defaultChoice(existing.profile.id, catalog), catalog)
  return suitability(remoteRecommendationState(item, catalog, fallback))
}

export function remoteAvailabilityLabel(item: DiscoveryResult, catalog: Catalog | null) {
  const existing = matchingLocalModel(item, catalog)
  return existing ? availabilityLabel(existing.status) : availabilityLabel('missing')
}

export function isVerifiedQuality(
  state: Pick<CreationState, 'profile' | 'configuration' | 'recommendation'> | null,
  format: 'square' | 'landscape' | 'portrait',
  quality: ImageQuality | null
) {
  if (!state?.recommendation.verified) return false
  const evidence = state.recommendation.evidenceDetails
  const [width, height] = startingSize(format, state.profile.family)
  const effective = quality ?? { width, height, steps: state.configuration.steps, cfg: state.configuration.cfg }
  return !!evidence
    && evidence.width === effective.width
    && evidence.height === effective.height
    && effective.steps === state.configuration.steps
    && effective.cfg === state.configuration.cfg
}

export function creationEvidenceLabel(state: Pick<CreationState, 'recommendation'>, verifiedQuality: boolean) {
  if (verifiedQuality) return 'Comprobado en este equipo'
  return suitability(state)
}

export function startingSize(format?: string, family?: string) {
  if (family === 'sdxl') return format === 'landscape' ? [768, 576] : format === 'portrait' ? [576, 768] : [768, 768]
  return format === 'landscape' ? [512, 384] : format === 'portrait' ? [384, 512] : [512, 512]
}
