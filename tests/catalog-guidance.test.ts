import { test, expect } from 'vitest'
import type { Catalog, CreationState, DiscoveryResult, SetupPlan } from '@veltria/contracts'
import { translate, recommendImage, starterProfile, sdxlProfile } from '@veltria/core'
import {
  primaryGpu,
  verifiedChoice,
  localPriority,
  purpose,
  compareLocalModels,
  rankWelcomeModels,
  selectWelcomeModels,
  defaultChoice,
  availabilityLabel,
  creationAvailabilityLabel,
  setupPlanAvailabilityLabel,
  setupPlanEvidenceLabel,
  suitability,
  modelEvidenceLabel,
  remoteRecommendationState,
  remoteEvidenceLabel,
  remoteAvailabilityLabel,
  isVerifiedQuality,
  creationEvidenceLabel
} from '../apps/ui/src/catalog-guidance'
import { fixtureHardware } from './creation-fixture'

type Model = Catalog['models'][number]

function fixture() {
  return {
    selectedModelId: 'model',
    selectedConfigurationId: 'square',
    configurations: [
      { id: 'square', configuration: { modelId: 'model', parameters: { format: 'square', steps: 20, cfg: 7 } } },
      { id: 'wide', configuration: { modelId: 'model', parameters: { format: 'landscape', steps: 20, cfg: 7 } } }
    ],
    models: [
      {
        profile: { id: 'model', family: 'sd15' },
        status: 'prepared',
        recommendation: { level: 'recommended', reason: 'Tu NVIDIA fixture cumple los mínimos.', verified: true, evidenceDetails: { at: '2026-11-19T00:00:00Z', width: 512, height: 512 } }
      }
    ]
  } as unknown as Catalog
}

function modelFixture(overrides: {
  id: string
  family?: 'sd15' | 'sdxl'
  adaptation?: { base: string; strength: number }
  status: Model['status']
  level: Model['recommendation']['level']
  reason?: string
  verified?: boolean
  evidenceDetails?: { at: string; width: number; height: number } | null
}): Model {
  return {
    profile: { id: overrides.id, model: overrides.id, family: overrides.family ?? 'sd15', ...(overrides.adaptation ? { adaptation: overrides.adaptation } : {}) },
    status: overrides.status,
    received: overrides.status === 'partial' ? 512 * 1024 ** 2 : 0,
    recommendation: {
      level: overrides.level,
      reason: overrides.reason ?? 'Fixture recommendation reason',
      verified: overrides.verified ?? false,
      evidence: null,
      evidenceDetails: overrides.evidenceDetails ?? null
    }
  } as unknown as Model
}

function catalogFixture(models: Model[], selectedModelId = models[0]?.profile.id ?? 'sd15-starter', selectedConfigurationId?: string): Catalog {
  const configurations = models.flatMap(item => [
    { id: `${item.profile.id}:balanced`, origin: 'included', configuration: { modelId: item.profile.id, name: 'Equilibrada', parameters: { format: 'square', steps: 20, cfg: 7 } } },
    { id: `${item.profile.id}:wide`, origin: 'included', configuration: { modelId: item.profile.id, name: 'Horizontal', parameters: { format: 'landscape', steps: 20, cfg: 7 } } }
  ])
  return {
    selectedModelId,
    selectedConfigurationId: selectedConfigurationId ?? `${selectedModelId}:balanced`,
    busy: false,
    models,
    configurations
  } as unknown as Catalog
}

test('catalog evidence applies only to the selected configuration and actual output dimensions', () => {
  const catalog = fixture(), model = catalog.models[0]
  expect(verifiedChoice(model, 'square', catalog)).toBe(true)
  expect(verifiedChoice(model, 'wide', catalog)).toBe(false)
  catalog.selectedConfigurationId = 'wide'
  expect(verifiedChoice(model, 'wide', catalog)).toBe(false)
  model.recommendation.evidenceDetails = { at: 'today', width: 512, height: 384 }
  expect(verifiedChoice(model, 'wide', catalog)).toBe(true)
})

test('recommendations prioritize ready options and do not invent a community model specialty', () => {
  const catalog = fixture(), model = catalog.models[0]
  expect(localPriority(model, 'square', catalog)).toBe(0)
  expect(localPriority({ ...model, status: 'missing', recommendation: { ...model.recommendation, verified: false } }, 'square', catalog)).toBeGreaterThan(localPriority({ ...model, recommendation: { ...model.recommendation, verified: false } }, 'square', catalog))
  expect(purpose('unknown-model', false)).toContain('descripción del autor')
  expect(purpose('unknown-model', true)).toContain('modelo base')
})

test('Welcome and Catalog share priority across verification, local availability, compatibility level, and adaptations', () => {
  const verified = modelFixture({ id: 'sd15-starter', status: 'prepared', level: 'recommended', verified: true, evidenceDetails: { at: '2026-11-19T00:00:00Z', width: 512, height: 512 } })
  const prepared = modelFixture({ id: 'dreamshaper-8', status: 'prepared', level: 'recommended' })
  const downloaded = modelFixture({ id: 'sdxl-base', family: 'sdxl', status: 'downloaded', level: 'limited', reason: 'SDXL usa un perfil de 768 píxeles.' })
  const partial = modelFixture({ id: 'community-partial', status: 'partial', level: 'recommended' })
  const missingRecommended = modelFixture({ id: 'community-missing', status: 'missing', level: 'recommended' })
  const missingLimited = modelFixture({ id: 'community-limited', status: 'missing', level: 'limited' })
  const preparedUnsupported = modelFixture({ id: 'sdxl-unsupported', family: 'sdxl', status: 'prepared', level: 'unsupported' })
  const preparedUnknown = modelFixture({ id: 'unknown-hw', status: 'prepared', level: 'unknown' })
  const lora = modelFixture({ id: 'style-lora', status: 'prepared', level: 'recommended', adaptation: { base: 'sd15-starter', strength: 0.7 } })

  const catalog = catalogFixture(
    [preparedUnsupported, missingLimited, lora, missingRecommended, partial, preparedUnknown, downloaded, prepared, verified],
    'sd15-starter',
    'sd15-starter:balanced'
  )

  const catalogOrder = [...catalog.models]
    .filter(item => !item.profile.adaptation)
    .sort((a, b) => compareLocalModels(a, b, catalog))
    .map(item => item.profile.id)

  const welcomeOrder = rankWelcomeModels(catalog).map(item => item.profile.id)
  expect(welcomeOrder).toEqual(catalogOrder)
  expect(welcomeOrder).toEqual([
    'sd15-starter',
    'dreamshaper-8',
    'sdxl-base',
    'community-partial',
    'community-missing',
    'community-limited',
    'unknown-hw',
    'sdxl-unsupported'
  ])
  expect(welcomeOrder).not.toContain('style-lora')
})

test('Welcome promotes an already-prepared compatible model while honoring an explicit user choice', () => {
  const sd15Missing = modelFixture({ id: 'sd15-starter', status: 'missing', level: 'recommended' })
  const dreamshaperPrepared = modelFixture({ id: 'dreamshaper-8', status: 'prepared', level: 'recommended' })
  const sdxlMissing = modelFixture({ id: 'sdxl-base', family: 'sdxl', status: 'missing', level: 'limited', reason: 'SDXL usa un perfil de 768 píxeles.' })

  const catalog = catalogFixture([sd15Missing, dreamshaperPrepared, sdxlMissing], 'sd15-starter')

  const initial = selectWelcomeModels(catalog, false)
  expect(initial.primary?.profile.id).toBe('dreamshaper-8')
  expect(initial.alternative?.profile.id).toBe('sd15-starter')

  const userPicked = selectWelcomeModels({ ...catalog, selectedModelId: 'sdxl-base', selectedConfigurationId: 'sdxl-base:balanced' }, true)
  expect(userPicked.primary?.profile.id).toBe('sdxl-base')
  expect(userPicked.alternative?.profile.id).toBe('dreamshaper-8')
})

test('Welcome and Catalog rank recommended before limited when local availability is equal', () => {
  const sdxl = modelFixture({ id: 'sdxl-base', family: 'sdxl', status: 'missing', level: 'limited', reason: 'SDXL usa un perfil de 768 píxeles.' })
  const sd15 = modelFixture({ id: 'sd15-starter', status: 'missing', level: 'recommended' })
  const catalog = catalogFixture([sdxl, sd15], 'sdxl-base')

  const { choices, primary, alternative } = selectWelcomeModels(catalog, false)
  expect(choices.map(item => item.profile.id)).toEqual(['sd15-starter', 'sdxl-base'])
  expect(primary?.profile.id).toBe('sd15-starter')
  expect(alternative?.profile.id).toBe('sdxl-base')
})

test('estimation, availability, and verification labels stay consistent across Welcome, Catalog, and Create in ES and EN', () => {
  const statuses: Model['status'][] = ['missing', 'partial', 'downloaded', 'prepared']
  const availabilityLabels = statuses.map(status => availabilityLabel(status))
  expect(new Set(availabilityLabels).size).toBe(4)

  const sd15Verified = modelFixture({
    id: 'sd15-starter',
    status: 'prepared',
    level: 'recommended',
    reason: recommendImage(fixtureHardware, starterProfile).reason,
    verified: true,
    evidenceDetails: { at: '2026-11-19T00:00:00Z', width: 512, height: 512 }
  })
  const sdxlLimited = modelFixture({
    id: 'sdxl-base',
    family: 'sdxl',
    status: 'missing',
    ...recommendImage(fixtureHardware, sdxlProfile)
  })
  const lowFreeMem = modelFixture({
    id: 'low-mem',
    status: 'missing',
    ...recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: 1 * 1024 ** 3 } }, starterProfile)
  })
  const unreadableFreeRam = modelFixture({
    id: 'unknown-free-ram',
    status: 'missing',
    ...recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: null } }, starterProfile)
  })
  const unknownHw = modelFixture({
    id: 'unknown-gpu',
    status: 'missing',
    ...recommendImage({ ...fixtureHardware, gpus: [] }, starterProfile)
  })
  const unsupportedHw = modelFixture({
    id: 'unsupported-sdxl',
    family: 'sdxl',
    status: 'missing',
    ...recommendImage({ ...fixtureHardware, gpus: [{ ...fixtureHardware.gpus[0], vramTotal: 4 * 1024 ** 3 }] }, sdxlProfile)
  })

  const catalog = catalogFixture(
    [sd15Verified, sdxlLimited, lowFreeMem, unreadableFreeRam, unknownHw, unsupportedHw],
    'sd15-starter',
    'sd15-starter:balanced'
  )

  // Verified on default square configuration, drops to estimated when changing configuration to landscape
  expect(modelEvidenceLabel(sd15Verified, defaultChoice('sd15-starter', catalog), catalog)).toBe('Comprobado con los ajustes elegidos')
  expect(modelEvidenceLabel(sd15Verified, 'sd15-starter:wide', catalog)).toBe('Compatible estimado · falta probar esta configuración')

  // Create studio matches exact suitability labels whenever format, resolution, steps, or CFG depart from evidence
  const createState = {
    profile: { family: 'sd15' },
    configuration: { steps: 20, cfg: 7 },
    recommendation: sd15Verified.recommendation
  } as unknown as CreationState

  expect(isVerifiedQuality(createState, 'square', null)).toBe(true)
  expect(creationEvidenceLabel(createState, true)).toBe('Comprobado en este equipo')

  expect(isVerifiedQuality(createState, 'landscape', null)).toBe(false)
  expect(creationEvidenceLabel(createState, false)).toBe(modelEvidenceLabel(sd15Verified, 'sd15-starter:wide', catalog))

  expect(isVerifiedQuality(createState, 'square', { width: 768, height: 768, steps: 20, cfg: 7 })).toBe(false)
  expect(isVerifiedQuality(createState, 'square', { width: 512, height: 512, steps: 30, cfg: 7 })).toBe(false)
  expect(isVerifiedQuality(createState, 'square', { width: 512, height: 512, steps: 20, cfg: 6.5 })).toBe(false)

  // Every non-verified model gets the exact same suitability label in Welcome, Catalog, and Create
  for (const item of [sdxlLimited, lowFreeMem, unreadableFreeRam, unknownHw, unsupportedHw]) {
    const catalogAndWelcomeLabel = modelEvidenceLabel(item, defaultChoice(item.profile.id, catalog), catalog)
    const createLabel = creationEvidenceLabel({ recommendation: item.recommendation }, false)
    expect(catalogAndWelcomeLabel).toBe(createLabel)
    expect(catalogAndWelcomeLabel).toBe(suitability(item))
  }

  expect(suitability(sdxlLimited)).toBe('Con ajustes de memoria · ejecución por comprobar')
  expect(suitability(lowFreeMem)).toBe('Cumple los mínimos · memoria libre limitada')
  expect(suitability(unreadableFreeRam)).toBe('Cumple los mínimos · memoria libre sin confirmar')
  expect(suitability(unknownHw)).toBe('Compatibilidad sin confirmar')
  expect(suitability(unsupportedHw)).toBe('No admitido en este equipo')
  expect(suitability(null)).toBe('Compatibilidad por revisar')

  // Every generated label must have an English translation
  const sdxlUnreadableFreeRam = modelFixture({
    id: 'sdxl-null-free',
    family: 'sdxl',
    status: 'missing',
    ...recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: null } }, sdxlProfile)
  })
  const sdxlLowFreeRam = modelFixture({
    id: 'sdxl-low-free',
    family: 'sdxl',
    status: 'missing',
    ...recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: 2 * 1024 ** 3 } }, sdxlProfile)
  })
  expect(suitability(sdxlUnreadableFreeRam)).toBe('Con ajustes de memoria · memoria libre sin confirmar')
  expect(suitability(sdxlLowFreeRam)).toBe('Con ajustes de memoria · poca memoria libre')

  const allLabels = [
    ...availabilityLabels,
    'Preparación en curso',
    'Comprobado con los ajustes elegidos',
    'Comprobado en este equipo',
    suitability(null),
    suitability(sd15Verified),
    suitability(sdxlLimited),
    suitability(sdxlUnreadableFreeRam),
    suitability(sdxlLowFreeRam),
    suitability(lowFreeMem),
    suitability(unreadableFreeRam),
    suitability(unknownHw),
    suitability(unsupportedHw)
  ]
  for (const label of allLabels) {
    expect(translate(label, 'en'), `missing English translation for "${label}"`).not.toBe(label)
  }
})

test('CreationStudio, SetupWizard, remote catalog, and dual-GPU helpers keep availability, estimation, and verification coherent in ES and EN', () => {
  // Dual-GPU laptop: prefer NVIDIA with known VRAM over integrated GPU with null VRAM
  const dualGpuHw = {
    ...fixtureHardware,
    gpus: [
      { name: 'Intel UHD Graphics', vramTotal: null, vramAvailable: null, driver: 'intel', source: 'fixture' },
      fixtureHardware.gpus[0]
    ]
  }
  expect(primaryGpu(dualGpuHw)?.name).toBe(fixtureHardware.gpus[0].name)
  expect(primaryGpu({ ...fixtureHardware, gpus: [] })).toBeNull()

  // CreationStudio availability labels match catalog vocabulary across preparation states
  expect(creationAvailabilityLabel({ canCreate: true, preparation: { status: 'ready', received: 100, total: 100 } } as CreationState)).toBe('Preparado para crear')
  expect(creationAvailabilityLabel({ canCreate: false, preparation: { status: 'downloading', received: 50, total: 100 } } as CreationState)).toBe('Preparación en curso')
  expect(creationAvailabilityLabel({ canCreate: false, preparation: { status: 'paused', received: 50, total: 100 } } as CreationState)).toBe('Descarga parcial')
  expect(creationAvailabilityLabel({ canCreate: false, preparation: { status: 'idle', received: 100, total: 100 } } as CreationState)).toBe('Descargado · falta comprobar')
  expect(creationAvailabilityLabel({ canCreate: false, preparation: { status: 'idle', received: 0, total: 100 } } as CreationState)).toBe('Sin descargar')

  // SetupPlan uses shared catalog evidence & availability labels
  const verifiedSd15 = {
    ...modelFixture({
      id: 'sd15-starter',
      status: 'prepared',
      level: 'recommended',
      reason: recommendImage(fixtureHardware, starterProfile).reason,
      verified: true,
      evidenceDetails: { at: '2026-11-19T00:00:00Z', width: 512, height: 512 }
    }),
    profile: { id: 'sd15-starter', model: 'Stable Diffusion 1.5', family: 'sd15', source: 'https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive' }
  } as unknown as Model
  const sdxlUnsupported = {
    ...modelFixture({
      id: 'sdxl-base',
      family: 'sdxl',
      status: 'missing',
      ...recommendImage({ ...fixtureHardware, gpus: [{ ...fixtureHardware.gpus[0], vramTotal: 4 * 1024 ** 3 }] }, sdxlProfile)
    }),
    profile: { id: 'sdxl-base', model: 'SDXL Base 1.0', family: 'sdxl', source: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0' }
  } as unknown as Model
  const catalog = catalogFixture([verifiedSd15, sdxlUnsupported], 'sd15-starter', 'sd15-starter:balanced')

  const plan = {
    profile: { id: 'sd15-starter' },
    configurationId: 'sd15-starter:balanced',
    recommendation: verifiedSd15.recommendation,
    preparation: { remainingBytes: 0, reuseBytes: 100 }
  } as unknown as SetupPlan
  expect(setupPlanEvidenceLabel(plan, catalog)).toBe('Comprobado con los ajustes elegidos')
  expect(setupPlanAvailabilityLabel(plan, catalog)).toBe('Preparado para crear')
  expect(setupPlanAvailabilityLabel({ ...plan, profile: { id: 'other' }, preparation: { remainingBytes: 50, reuseBytes: 25 } } as unknown as SetupPlan, catalog)).toBe('Descarga parcial')

  // Remote results reuse matching local evidence/availability AND evaluate SDXL remote entries with SDXL recommendation
  const remoteMatchingSd15 = { repository: 'Comfy-Org/stable-diffusion-v1-5-archive', source: verifiedSd15.profile.source, family: 'SD 1.5', kind: 'model', supported: true } as DiscoveryResult
  expect(remoteEvidenceLabel(remoteMatchingSd15, catalog, null)).toBe('Comprobado con los ajustes elegidos')
  expect(remoteAvailabilityLabel(remoteMatchingSd15, catalog)).toBe('Preparado para crear')

  const remoteUnmatchedSdxl = { repository: 'other/sdxl-community', source: 'https://huggingface.co/other/sdxl-community', family: 'SDXL', kind: 'model', supported: true } as DiscoveryResult
  expect(remoteRecommendationState(remoteUnmatchedSdxl, catalog, null)?.recommendation.level).toBe('unsupported')
  expect(remoteEvidenceLabel(remoteUnmatchedSdxl, catalog, null)).toBe('No admitido en este equipo')
  expect(remoteAvailabilityLabel(remoteUnmatchedSdxl, catalog)).toBe('Sin descargar')

  const remoteUnsupportedRecipe = { repository: 'other/flux', source: 'https://huggingface.co/other/flux', family: 'unknown', kind: 'model', supported: false } as DiscoveryResult
  expect(remoteEvidenceLabel(remoteUnsupportedRecipe, catalog, null)).toBe('Compatibilidad por revisar')
  expect(remoteAvailabilityLabel(remoteUnsupportedRecipe, catalog)).toBe('Sin descargar')
})
