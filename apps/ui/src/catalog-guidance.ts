import type { Catalog, CreationState, DiscoveryResult } from '@veltria/contracts'
type Model = Catalog['models'][number]
export function verifiedChoice(item: Model, choice: string, catalog: Catalog) {
  const configuration = catalog.configurations.find(entry => entry.id === choice)?.configuration
  const size = startingSize(configuration?.parameters.format, item.profile.family)
  const evidence = item.recommendation.evidenceDetails
  return !!evidence && evidence.width === size[0] && evidence.height === size[1] && item.recommendation.verified && catalog.selectedModelId === item.profile.id && catalog.selectedConfigurationId === choice
}
export function localPriority(item: Model, choice: string, catalog: Catalog) {
  if (['unsupported', 'unknown'].includes(item.recommendation.level)) return 5
  if (verifiedChoice(item, choice, catalog)) return 0
  return { prepared: 1, downloaded: 2, partial: 3, missing: 4 }[item.status]
}
export function purpose(id: string, adaptation: boolean) {
  if (adaptation) return 'Para adaptar un estilo, personaje o efecto sobre un modelo base.'
  if (id === 'sdxl-base') return 'Para explorar SDXL con ajustes conservadores para 6 GB.'
  if (id === 'dreamshaper-8') return 'Para explorar ilustración y estilos artísticos.'
  if (id === 'sd15-starter') return 'Para empezar con imágenes de uso general.'
  return 'Modelo de la comunidad. Revisa los ejemplos y la descripción del autor para conocer su especialidad.'
}
export function remotePriority(item: DiscoveryResult, catalog: Catalog | null) {
  if (!item.supported) return 5
  const existing = catalog?.models.find(model => model.profile.source === item.source && !model.profile.adaptation)
  return existing ? localPriority(existing, catalog!.selectedConfigurationId, catalog!) : 4
}
export function suitability(state: Pick<CreationState,'recommendation'> | null) {
  if (!state || ['unknown','unsupported'].includes(state.recommendation.level)) return 'Compatibilidad por revisar'
  if(state.recommendation.reason.startsWith('SDXL '))return 'Con ajustes de memoria · ejecución por comprobar'
  return state.recommendation.level === 'limited' ? 'Cumple los mínimos · memoria libre limitada' : 'Compatible estimado · falta probar esta configuración'
}

export function startingSize(format?: string, family?:string) { if(family==='sdxl')return format==='landscape'?[768,576]:format==='portrait'?[576,768]:[768,768];return format === 'landscape' ? [512,384] : format === 'portrait' ? [384,512] : [512,512] }
