import type { Hardware } from '@veltria/contracts'
export type ImageProfile = {
  family?: 'sd15' | 'sdxl'; id: string; revision: string; title: string; description: string; model: string;
  source: string; license: string; licenseUrl: string; bytes: number; sha256: string;
  url: string; filename: string; width: number; height: number; steps: number; limitations: string[]; adaptation?: { base: string; strength: number }
}
export const starterProfile: ImageProfile = {
  id: 'sd15-starter', revision: 'sd15-fp16-euler-20-v1', title: 'Imagen inicial',
  description: 'Una opción de consumo moderado para empezar con imágenes de 512 píxeles.', model: 'Stable Diffusion 1.5 · FP16',
  source: 'https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive',
  license: 'CreativeML OpenRAIL-M', licenseUrl: 'https://huggingface.co/spaces/CompVis/stable-diffusion-license/blob/main/license',
  bytes: 2132696762, sha256: 'e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916',
  url: 'https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive/resolve/9cfd069101959ca3828bf9c04a4419870832b74f/v1-5-pruned-emaonly-fp16.safetensors',
  filename: 'veltria-sd15-e9476a13.safetensors', width: 512, height: 512, steps: 20,
  limitations: ['Modelo clásico de 2022: calidad y comprensión inferiores a modelos recientes.', 'Interpreta mejor las descripciones en inglés; el español puede dar resultados menos fieles.', 'Texto, rostros y detalles pequeños pueden contener errores.']
}
export const dimensions = { square: [512, 512], landscape: [512, 384], portrait: [384, 512] } as const
export function recommendImage(hardware: Hardware, profile?: Pick<ImageProfile,'family'>) {
  if (!['win32', 'linux'].includes(hardware.platform)) return { level: 'unsupported' as const, reason: 'Este perfil sólo está habilitado en Windows y Linux. macOS sigue pendiente de validación.' }
  const nvidia = hardware.gpus.find(gpu => /nvidia/i.test(gpu.name))
  if (!nvidia || nvidia.vramTotal === null) return { level: 'unknown' as const, reason: 'No se pudo confirmar una GPU NVIDIA con memoria dedicada suficiente. Actualiza la detección del equipo.' }
  if(profile?.family==='sdxl') {
    if(!['win32','linux'].includes(hardware.platform)) return {level:'unsupported' as const,reason:'SDXL sólo está habilitado en Windows y Linux; macOS está pendiente.'}
    if(nvidia.vramTotal < 5.5 * 1024 ** 3 || (hardware.ram.total??0)<14*1024**3) return {level:'unsupported' as const,reason:'Este perfil SDXL requiere al menos 6 GB de VRAM y 16 GB de RAM nominales; no está verificado para equipos menores.'}
    return {level:'limited' as const,reason:'SDXL usa un perfil de 768 píxeles y descarga parcial de memoria a RAM. Cierra otras aplicaciones antes de preparar; la ejecución se comprobará con una imagen real.'}
  }
  // The OS reports usable memory, slightly below the nominal 4/8 GB device capacities.
  if (nvidia.vramTotal < 3.5 * 1024 ** 3 || (hardware.ram.total ?? 0) < 7 * 1024 ** 3) return { level: 'unsupported' as const, reason: 'Este primer perfil necesita una GPU NVIDIA de al menos 4 GB y 8 GB de RAM nominales. No se ha validado una alternativa para este equipo.' }
  if ((hardware.ram.available ?? 0) < 1.5 * 1024 ** 3 || nvidia.vramAvailable !== null && nvidia.vramAvailable < 2 * 1024 ** 3) return { level: 'limited' as const, reason: 'El equipo cumple los mínimos, pero queda poca memoria libre. Cierra aplicaciones que usen GPU o mucha RAM antes de crear.' }
  return { level: 'recommended' as const, reason: `Tu ${nvidia.name} cumple los mínimos de este perfil a 512 píxeles. La recomendación inicial se basa en recursos; la primera imagen comprobará la ejecución.` }
}
export const recipeNodes = ['CheckpointLoaderSimple', 'CLIPTextEncode', 'EmptyLatentImage', 'KSampler', 'VAEDecode', 'SaveImage'] as const
export function imageWorkflow(checkpoint: string, prompt: string, width: number, height: number, seed: number, jobId: string, steps = 20, cfg = 7, lora?: { filename: string; strength: number }) {
  const modelNode = lora ? '8' : '1'
  return {
    ...(lora ? { '8': { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['1', 1], lora_name: lora.filename, strength_model: lora.strength, strength_clip: lora.strength } } } : {}),
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: [modelNode, 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: [modelNode, 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: { model: [modelNode, 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed, steps, cfg, sampler_name: 'euler', scheduler: 'normal', denoise: 1 } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: `veltria_${jobId}` } }
  }
}

export function profileDimensions(format: 'square'|'landscape'|'portrait', profile?: Pick<ImageProfile,'family'>) { return profile?.family==='sdxl' ? ({square:[768,768],landscape:[768,576],portrait:[576,768]} as const)[format] : dimensions[format] }
