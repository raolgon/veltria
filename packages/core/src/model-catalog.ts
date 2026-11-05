import type { ConfigurationEntry, ImageConfiguration } from '@veltria/contracts'
import { starterProfile, type ImageProfile } from './image-profile'

export const dreamshaperProfile: ImageProfile = {
  ...starterProfile, id: 'dreamshaper-8', revision: 'dreamshaper8-fp16-euler-v1', title: 'DreamShaper 8',
  description: 'Una alternativa basada en SD 1.5 para explorar ilustración y estilos artísticos.',
  model: 'DreamShaper 8 · FP16', source: 'https://huggingface.co/Lykon/DreamShaper',
  license: 'Condiciones del autor · other',
  licenseUrl: 'https://huggingface.co/Lykon/DreamShaper/blob/228d79cb20811466f5c5710aa91f05dabd0b8a14/README.md',
  bytes: 2132625894, sha256: '879db523c30d3b9017143d56705015e15a2cb5628762c11d086fed9538abd7fd',
  url: 'https://huggingface.co/Lykon/DreamShaper/resolve/228d79cb20811466f5c5710aa91f05dabd0b8a14/DreamShaper_8_pruned.safetensors',
  filename: 'veltria-dreamshaper8-879db523.safetensors', steps: 25,
  limitations: [
    'La ejecución se comprueba por equipo y configuración. Un resultado correcto no garantiza otros ajustes.',
    'El repositorio del checkpoint declara licencia «other» y remite a las condiciones del autor. Revísalas antes de descargar y utilizar el modelo.',
    ...starterProfile.limitations.slice(1)
  ]
}
export const imageModels: readonly ImageProfile[] = [starterProfile, dreamshaperProfile]
export function configurationsFor(model: ImageProfile): ConfigurationEntry[] {
  const entry = (suffix: string, name: string, description: string, steps: number, cfg = 7): ConfigurationEntry => ({
    id: `${model.id}-${suffix}`, origin: 'included', configuration: {
      kind: 'veltria-image-configuration', version: 1, name, description, modelId: model.id,
      recipe: 'sd15-text-to-image-v1', parameters: { steps, cfg, sampler: 'euler', scheduler: 'normal', format: 'square' }
    }
  })
  return [entry('balanced', 'Equilibrada', 'El punto de partida del modelo: imágenes de 512 píxeles.', model.steps),
    entry('draft', 'Borrador rápido', 'Menos pasos para explorar una idea; puede perder detalle.', 12),
    entry('detail', 'Más pasos', 'Dedica más trabajo a cada imagen. La mejora de calidad depende de la escena.', 30)]
}
export function configurationRevision(configuration: ImageConfiguration) {
  return JSON.stringify({ modelId: configuration.modelId, recipe: configuration.recipe, parameters: configuration.parameters })
}
