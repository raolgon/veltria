export const videoFiles = [
  { role: 'Modelo de video', folder: 'diffusion_models', filename: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors' },
  { role: 'Codificador del perfil', folder: 'text_encoders', filename: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors' },
  { role: 'Decodificador de video', folder: 'vae', filename: 'minimax_h3_video_vae_fp16.safetensors' },
  { role: 'Decodificador de audio', folder: 'vae', filename: 'minimax_h3_audio_vae_fp32.safetensors' }
] as const
export const videoPresets = {
  preview: { width: 448, height: 256, frames: 22, fps: 24, steps: 20 },
  short: { width: 448, height: 256, frames: 124, fps: 24, steps: 20 }
} as const
export const videoRevision = 'h3-native-int8-448-v1'
export const videoNodes = ['CLIPLoader', 'UNETLoader', 'VAELoader', 'MiniMaxH3SigmaShift', 'MiniMaxH3ImageToVideo', 'BasicGuider', 'KSamplerSelect', 'BasicScheduler', 'RandomNoise', 'SamplerCustomAdvanced', 'VAEDecode', 'VAEDecodeAudio', 'CreateVideo', 'SaveVideo'] as const
/** Curated flat API recipe; never execute imported workflow JSON or arbitrary custom nodes. */
export function videoWorkflow(prompt: string, preset: keyof typeof videoPresets, seed: number, id: string) {
  const size = videoPresets[preset]
  return {
    '1': { class_type: 'CLIPLoader', inputs: { clip_name: videoFiles[1].filename, type: 'minimax', device: 'default' } },
    '2': { class_type: 'UNETLoader', inputs: { unet_name: videoFiles[0].filename, weight_dtype: 'default' } },
    '3': { class_type: 'MiniMaxH3SigmaShift', inputs: { model: ['2', 0], shift_video: 12, shift_audio: 3 } },
    '4': { class_type: 'VAELoader', inputs: { vae_name: videoFiles[2].filename } },
    '5': { class_type: 'VAELoader', inputs: { vae_name: videoFiles[3].filename } },
    '6': { class_type: 'MiniMaxH3ImageToVideo', inputs: { clip: ['1', 0], vae: ['4', 0], prompt, width: size.width, height: size.height, length: size.frames } },
    '7': { class_type: 'BasicGuider', inputs: { model: ['3', 0], conditioning: ['6', 0] } },
    '8': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'res_multistep' } },
    '9': { class_type: 'BasicScheduler', inputs: { model: ['3', 0], scheduler: 'simple', steps: size.steps, denoise: 1 } },
    '10': { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    '11': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['10', 0], guider: ['7', 0], sampler: ['8', 0], sigmas: ['9', 0], latent_image: ['6', 1] } },
    '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['4', 0] } },
    '13': { class_type: 'VAEDecodeAudio', inputs: { samples: ['11', 0], vae: ['5', 0] } },
    '14': { class_type: 'CreateVideo', inputs: { images: ['12', 0], audio: ['13', 0], fps: size.fps, bit_depth: 8, color_space: 'sRGB' } },
    '15': { class_type: 'SaveVideo', inputs: { video: ['14', 0], filename_prefix: `veltria_video_${id}`, format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 'auto' } }
  }
}
