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
export const sdxlProfile: ImageProfile = {
  family:'sdxl',id:'sdxl-base',revision:'sdxl-base-fp16-lowvram-768-v1',title:'SDXL Base',model:'Stable Diffusion XL Base 1.0',
  description:'Una familia posterior a SD 1.5 para explorar composiciones y más detalle. Perfil inicial conservador para 6 GB.',
  source:'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0',license:'CreativeML Open RAIL++-M',licenseUrl:'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/462165984030d82259a11f4367a4eed129e94a7b/LICENSE.md',
  bytes:6938078334,sha256:'31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b',filename:'veltria-sdxl-base-31e35c80.safetensors',
  url:'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/462165984030d82259a11f4367a4eed129e94a7b/sd_xl_base_1.0.safetensors',width:768,height:768,steps:20,
  limitations:['SDXL sin refiner, con nodos estándar y modo de memoria reducido. No modifica tu instalación de ComfyUI.','La resolución inicial de 768 píxeles reduce el trabajo respecto al formato nativo de 1024. No se prometen tiempos ni calidad superior en todas las escenas.','LoRA de SD 1.5 no compatibles con esta familia. LoRA de SDXL y otras variantes: pendientes.','La ejecución se comprueba por equipo y configuración. Un resultado correcto no garantiza otros ajustes.']
}
export const imageModels: readonly ImageProfile[] = [starterProfile, dreamshaperProfile, sdxlProfile]
export function configurationsFor(model: ImageProfile): ConfigurationEntry[] {
  const entry = (suffix: string, name: string, description: string, steps: number, cfg = 7): ConfigurationEntry => ({
    id: `${model.id}-${suffix}`, origin: 'included', configuration: {
      kind: 'veltria-image-configuration', version: 1, name, description, modelId: model.id,
      recipe: model.family==='sdxl'?'sdxl-text-to-image-v1':'sd15-text-to-image-v1', parameters: { steps, cfg, sampler: 'euler', scheduler: 'normal', format: 'square' }
    }
  })
  return [entry('balanced', 'Equilibrada', model.family==='sdxl'?'El punto de partida de SDXL: imágenes de 768 píxeles.':'El punto de partida del modelo: imágenes de 512 píxeles.', model.steps),
    entry('draft', 'Borrador rápido', 'Menos pasos para explorar una idea; puede perder detalle.', 12),
    entry('detail', 'Más pasos', 'Dedica más trabajo a cada imagen. La mejora de calidad depende de la escena.', 30)]
}
export function configurationRevision(configuration: ImageConfiguration) {
  return JSON.stringify({ modelId: configuration.modelId, recipe: configuration.recipe, parameters: configuration.parameters })
}
