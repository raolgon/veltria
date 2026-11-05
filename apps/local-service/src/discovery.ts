import { z } from 'zod'
import { createHash } from 'node:crypto'
import { starterProfile, imageModels, type ImageProfile } from '@veltria/core'
import { discoveryResultSchema } from '@veltria/contracts'
const repository = z.string().regex(/^[\w.-]+\/[\w.-]+$/).max(180)
export const discoverInput = z.object({ query: z.string().trim().max(100), kind: z.enum(['all', 'model', 'lora']).default('all') }).strict()
export const adoptInput = z.object({ repository, file: z.string().max(300), strength: z.number().min(0).max(1.5).default(0.7), baseModelId: z.string().max(100).default('sd15-starter') }).strict()
const fileSchema = z.object({ rfilename: z.string(), lfs: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().positive() }).optional() })
const metadata = z.object({ id: repository, sha: z.string().regex(/^[a-f0-9]{40}$/), tags: z.array(z.string()).default([]), gated: z.union([z.boolean(), z.string()]).optional(), cardData: z.record(z.string(), z.unknown()).nullish(), siblings: z.array(fileSchema).default([]) })
async function hub(path: string) {
  const response = await fetch('https://huggingface.co/api/models' + path, { signal: AbortSignal.timeout(8000), redirect: 'error' })
  if (!response.ok) throw new Error('No se pudo consultar Hugging Face. Vuelve a buscar; tu catálogo local sigue disponible.')
  const reader = response.body!.getReader(); let bytes = 0; const chunks: Uint8Array[] = []
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 2 * 1024 ** 2) throw new Error('La respuesta del proveedor supera el límite. Busca un nombre más concreto.'); chunks.push(value) } }
  finally { await reader.cancel() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}
export function inspectModel(value: unknown) {
  const data = metadata.parse(value), tags = data.tags.join(' ').toLowerCase()
  const base = JSON.stringify(data.cardData?.base_model || '').toLowerCase()
  const lora = /(?:^|\s)(?:lora|lycoris|peft)(?:\s|$)/.test(tags)
  const known = imageModels.some(model => model.source === `https://huggingface.co/${data.id}` && model.url.includes('/' + data.sha + '/'))
  const sd15 = known || /stable-diffusion-v1-5|stable-diffusion-v1.5|sd-1.5|sd15|sd-1-5/.test(base + ' ' + tags)
  const files = data.siblings.filter(file => file.rfilename.endsWith('.safetensors') && file.lfs && !file.rfilename.includes('/') && !/inpainting|lcm|turbo|unet|text_encoder/i.test(file.rfilename) && file.lfs.size < 6 * 1024 ** 3).sort((a,b) => Number(imageModels.some(model => model.sha256 === b.lfs!.sha256)) - Number(imageModels.some(model => model.sha256 === a.lfs!.sha256)) || a.lfs!.size - b.lfs!.size)
  const supported = sd15 && !data.gated && files.length > 0 && !/lycoris|dora|loha|lokr|locon/.test(tags)
  return { data, result: discoveryResultSchema.parse({ repository: data.id, revision: data.sha, kind: lora ? 'lora' : 'model', family: sd15 ? 'SD 1.5' : 'unknown', supported, files: files.map(file => ({ name: file.rfilename, bytes: file.lfs!.size })), reason: data.gated ? 'Este repositorio requiere acceso del proveedor; la conexión de cuentas está pendiente.' : supported ? 'Familia declarada compatible; ejecución sin comprobar.' : 'Veltria todavía no tiene una receta compatible confirmada para estos archivos.', source: `https://huggingface.co/${data.id}` }) }
}
export async function discover(query: string, kind: string) {
  const terms: Record<string,string> = { photography: 'realistic', fotografía: 'realistic', fotografia: 'realistic', ilustración: 'illustration', ilustracion: 'illustration', personajes: 'character', anime: 'anime' }
  const q = terms[query.toLowerCase()] || query
  const raw = z.array(z.object({ id: repository })).max(20).parse(await hub(`?search=${encodeURIComponent(q)}&${kind === 'lora' ? 'filter=lora' : 'pipeline_tag=text-to-image'}&sort=downloads&direction=-1&limit=8`))
  const results = await Promise.allSettled(raw.map(item => hub(`/${item.id}?blobs=true`).then(inspectModel)))
  const entries = results.flatMap(item => item.status === 'fulfilled' ? [item.value.result] : [])
  if (raw.length && !entries.length) throw new Error('No se pudieron comprobar los resultados. Vuelve a buscar.')
  return { results: entries.filter(item => kind === 'all' || item.kind === kind), partial: results.some(item => item.status === 'rejected') }
}
export function verifyTensorHeader(value: unknown, lora: boolean) {
  const tensors = z.record(z.string(), z.unknown()).parse(value), keys = Object.keys(tensors).filter(key => key !== '__metadata__')
  if (lora) {
    if (!keys.some(key => key.startsWith('lora_unet_') && key.endsWith('.lora_down.weight')) || keys.some(key => /dora|hada_|lokr_|lora_te2_/.test(key))) throw new Error('Esta variante de adaptación todavía no está admitida.')
  } else if (!keys.some(key => key.startsWith('model.diffusion_model.')) || !keys.some(key => key.startsWith('first_stage_model.')) || !keys.some(key => key.startsWith('cond_stage_model.'))) throw new Error('Este archivo no es un checkpoint completo compatible; faltan componentes de la receta.')
  const attention = keys.filter(key => lora ? /attn2_to_k.lora_down.weight$/.test(key) : /attn2.to_k.weight$/.test(key))
  if (!attention.length || attention.some(key => { const tensor = tensors[key] as {shape?: number[]}; return tensor.shape?.[1] !== 768 })) throw new Error('No se pudo confirmar la arquitectura SD 1.5 de este archivo.')
}
async function verifyRemoteHeader(url: string, lora: boolean) {
  async function range(start: number, end: number) {
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}`, 'accept-encoding': 'identity' }, signal: AbortSignal.timeout(8000) })
    if (response.status !== 206 || !response.headers.get('content-range')?.startsWith(`bytes ${start}-${end}/`)) { await response.body?.cancel(); throw new Error('El proveedor no permite comprobar este archivo con una lectura parcial.') }
    const reader = response.body!.getReader(), chunks: Uint8Array[] = []; let length = 0
    try { for (;;) { const {value, done} = await reader.read(); if (done) break; length += value.length; if (length > end - start + 1) throw new Error('Respuesta parcial incorrecta.'); chunks.push(value) } } finally { await reader.cancel() }
    if (length !== end - start + 1) throw new Error('Cabecera incompleta del proveedor.')
    return Buffer.concat(chunks)
  }
  const size = Number((await range(0, 7)).readBigUInt64LE())
  if (!Number.isSafeInteger(size) || size < 2 || size > 1024 ** 2) throw new Error('La cabecera del archivo no se puede comprobar dentro del límite admitido.')
  verifyTensorHeader(JSON.parse((await range(8, size + 7)).toString('utf8')), lora)
}
export async function resolveModel(repo: string, filename: string, strength = 0.7, baseModelId = starterProfile.id): Promise<ImageProfile> {
  const { data, result } = inspectModel(await hub(`/${repository.parse(repo)}?blobs=true`))
  if (!result.supported) throw new Error(result.reason)
  const file = data.siblings.find(item => item.rfilename === filename && result.files.some(f => f.name === filename))
  if (!file?.lfs) throw new Error('No se encontró un archivo verificable compatible.')
  await verifyRemoteHeader(`${result.source}/resolve/${data.sha}/${encodeURIComponent(filename)}`, result.kind === 'lora')
  const existing = imageModels.find(model => model.sha256 === file.lfs!.sha256)
  if (existing && result.kind !== 'lora') return existing
  const id = 'hf-' + createHash('sha256').update(repo + data.sha + filename + (result.kind === 'lora' ? baseModelId + strength : '')).digest('hex').slice(0, 24)
  const source = `https://huggingface.co/${repo}`
  return { ...starterProfile, id, revision: `${id}-v1`, title: repo.split('/')[1], model: repo, description: result.kind === 'lora' ? 'Adaptación para el modelo inicial SD 1.5.' : 'Modelo de la comunidad basado en SD 1.5.', source, license: String(data.cardData?.license || 'No declarada').slice(0, 200), licenseUrl: `${source}/blob/${data.sha}/README.md`, sha256: file.lfs.sha256, bytes: file.lfs.size, filename: `hf-${file.lfs.sha256.slice(0, 24)}.safetensors`, url: `${source}/resolve/${data.sha}/${encodeURIComponent(filename)}`, limitations: ['Familia declarada compatible; ejecución sin comprobar.', ...starterProfile.limitations], ...(result.kind === 'lora' ? { adaptation: { base: baseModelId, strength } } : {}) }
}
