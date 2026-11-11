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

// These are Veltria's supported direct-generation bounds, not universal model limits.
export function imageQualityLimits(profile?: Pick<ImageProfile, 'family'>) {
  return profile?.family === 'sdxl'
    ? { min: 512, max: 1536, sizes: [768, 1024, 1536], defaultSize: 768 }
    : { min: 256, max: 1024, sizes: [512, 768, 1024], defaultSize: 512 }
}
export function qualityDimensions(size: number, format: 'square' | 'landscape' | 'portrait'): [number, number] {
  const short = Math.round(size * 0.75 / 64) * 64
  return format === 'square' ? [size, size] : format === 'landscape' ? [size, short] : [short, size]
}
export function validImageQuality(quality: { width: number; height: number; steps: number; cfg: number }, profile?: Pick<ImageProfile, 'family'>) {
  const { min, max } = imageQualityLimits(profile)
  return [quality.width, quality.height].every(value => Number.isInteger(value) && value >= min && value <= max && value % 64 === 0)
    && Number.isInteger(quality.steps) && quality.steps >= 1 && quality.steps <= 60 && Number.isFinite(quality.cfg) && quality.cfg >= 1 && quality.cfg <= 15
}

export function classifyJobFailure(raw: { exceptionType?: string; exceptionMessage?: string; traceback?: string; nodeType?: string; errorMessage?: string }): { kind: 'memory' | 'incompatible' | 'engine-unavailable' | 'execution'; message: string; detail: string | null; node: string | null } {
  const parts = [raw.exceptionType, raw.exceptionMessage, raw.traceback, raw.errorMessage].filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  const text = parts.join('\n')
  const detail = text ? text.slice(0, 4000) : null
  const node = typeof raw.nodeType === 'string' && raw.nodeType.trim() ? raw.nodeType.trim().slice(0, 200) : null
  if (/OutOfMemoryError|CUDA out of memory|HIP out of memory|MPS backend out of memory|DefaultCPUAllocator: not enough memory|not enough memory: you tried to allocate|cannot allocate memory|Allocation on device|CUBLAS_STATUS_ALLOC_FAILED|std::bad_alloc|insufficient memory|oom/i.test(text)) {
    return {
      kind: 'memory',
      message: 'Se agotó la memoria disponible al crear la imagen. Se conservan tu descripción y ajustes; puedes reducir el tamaño o elegir un modelo menos exigente antes de volver a crear.',
      detail,
      node
    }
  }
  if (/El motor rechazó la receta|Falta el nodo|reconocer el modelo|cancelación segura|no corresponde a la familia|size mismatch for|Error\(s\) in loading state_dict|mat1 and mat2 shapes cannot be multiplied|Prompt outputs failed validation|Value not in list|missing keys in state_dict|unexpected key in state_dict|shape '.*' is invalid for input|Expected .* dimensions|return type|SafetensorError|HeaderTooLarge|MetadataIncompleteBuffer/i.test(text)) {
    return {
      kind: 'incompatible',
      message: 'El modelo o sus ajustes no son compatibles con esta receta en el motor. Se conservan tu descripción y ajustes; prueba otra configuración o modelo.',
      detail,
      node
    }
  }
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|socket|network|El motor existente no pudo arrancar|El motor tardó más de tres minutos|El motor no devolvió una cola válida|El motor devolvió una respuesta no válida|El motor respondió HTTP 5/i.test(text)) {
    return {
      kind: 'engine-unavailable',
      message: 'El motor local dejó de responder antes de terminar la imagen. Se conservan tu descripción y ajustes; comprueba el motor y vuelve a crear cuando quieras.',
      detail,
      node
    }
  }
  return {
    kind: 'execution',
    message: 'El motor encontró un fallo interno al crear la imagen. Se conservan tu descripción y ajustes; revisa los detalles técnicos o prueba con otros ajustes antes de volver a crear.',
    detail,
    node
  }
}

export function reduceImageQuality(job: { width: number; height: number; steps: number; cfg?: number; format: 'square' | 'landscape' | 'portrait' }, profile?: Pick<ImageProfile, 'family'>, defaultSteps = 20, defaultCfg = 7): { width: number; height: number; steps: number; cfg: number } | null {
  const [startWidth, startHeight] = profileDimensions(job.format, profile)
  const steps = Math.min(job.steps, defaultSteps)
  const cfg = job.cfg ?? defaultCfg
  if (job.width * job.height > startWidth * startHeight) {
    return { width: startWidth, height: startHeight, steps, cfg }
  }
  const { min } = imageQualityLimits(profile)
  const nextLong = Math.max(min, Math.max(job.width, job.height) - 128)
  const [reducedWidth, reducedHeight] = qualityDimensions(nextLong, job.format)
  if (reducedWidth * reducedHeight < job.width * job.height && reducedWidth >= min && reducedHeight >= min) {
    return { width: reducedWidth, height: reducedHeight, steps, cfg }
  }
  if (job.steps > 12) {
    return { width: job.width, height: job.height, steps: 12, cfg }
  }
  return null
}

