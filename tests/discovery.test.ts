import { test, expect, vi } from 'vitest'
import { browseCompatible, inspectModel, verifyTensorHeader } from '../apps/local-service/src/discovery'
import { imageWorkflow } from '@veltria/core'
const metadata = { id: 'author/model', sha: 'a'.repeat(40), tags: ['text-to-image', 'base_model:runwayml/stable-diffusion-v1-5'], siblings: [{ rfilename: 'full.safetensors', lfs: { sha256: 'b'.repeat(64), size: 2000000 } }] }
test('discovery distinguishes runnable family, gated access, LoRA and incomplete files', () => {
  expect(inspectModel(metadata).result.supported).toBe(true)
  expect(inspectModel({ ...metadata, gated: 'manual' }).result.supported).toBe(false)
  expect(inspectModel({ ...metadata, tags: ['sdxl'] }).result.supported).toBe(false)
  expect(inspectModel({ ...metadata, id: 'author/lcm-accelerated' }).result.supported).toBe(false)
  expect(inspectModel({ ...metadata, siblings: [{ rfilename: '../full.safetensors' }] }).result.files).toEqual([])
  expect(inspectModel({ ...metadata, tags: [...metadata.tags, 'lora'] }).result.kind).toBe('lora')
  expect(inspectModel({ ...metadata, tags: [...metadata.tags, 'lora', 'dora'] }).result.supported).toBe(false)
})
test('metadata does not replace tensor architecture and component checks', () => {
  const header = { 'model.diffusion_model.attn2.to_k.weight': { shape: [320, 768] }, 'first_stage_model.encoder': {}, 'cond_stage_model.transformer': {} }
  expect(() => verifyTensorHeader(header, false)).not.toThrow()
  expect(() => verifyTensorHeader({ ...header, 'model.diffusion_model.attn2.to_k.weight': {shape: [320, 2048]} }, false)).toThrow()
  expect(() => verifyTensorHeader({'model.diffusion_model.attn2.to_k.weight': {shape: [320, 768]}}, false)).toThrow()
  expect(() => verifyTensorHeader({'lora_unet_block_attn2_to_k.lora_down.weight': {shape: [4, 768]}}, true)).not.toThrow()
})
test('LoRA patches model and both text encodings while preserving VAE and output', () => {
  const workflow = imageWorkflow('base.safetensors', 'idea', 512, 512, 1, 'job', 20, 7, {filename: 'style.safetensors', strength: 0.7})
  expect(workflow['8']?.class_type).toBe('LoraLoader')
  expect(workflow['8']?.inputs.clip).toEqual(['1', 1])
  expect(workflow['2'].inputs.clip).toEqual(['8', 1])
  expect(workflow['3'].inputs.clip).toEqual(['8', 1])
  expect(workflow['5'].inputs.model).toEqual(['8', 0])
  expect(workflow['7'].class_type).toBe('SaveImage')
  expect(imageWorkflow('base', '', 512, 512, 1, 'job')['5'].inputs.model).toEqual(['1', 0])
})

test('compatible browsing needs no search text, retains pagination and sorts by provider downloads', async () => {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input); calls.push(url.href)
    if (url.pathname === '/api/models') return new Response(JSON.stringify([{id:'author/less'},{id:'author/popular'}]), {headers:{link:'<https://huggingface.co/api/models?cursor=next-page>; rel="next"'}})
    return Response.json({...metadata,id:url.pathname.slice('/api/models/'.length),downloads:url.pathname.endsWith('popular')?200:10})
  })
  try {
    const page = await browseCompatible('model','previous-page',async()=>{})
    expect(new URL(calls[0]).searchParams.has('search')).toBe(false)
    expect(new URL(calls[0]).searchParams.get('cursor')).toBe('previous-page')
    expect(new URL(calls[0]).searchParams.get('sort')).toBe('downloads')
    expect(page.results.map(item=>item.downloads)).toEqual([200,10])
    expect(page.nextCursor).toBe('next-page')
  } finally { vi.unstubAllGlobals() }
})
test('an incompatible page keeps its next cursor; no made-up popularity', async () => {
  vi.stubGlobal('fetch', async (input: string) => new URL(input).pathname === '/api/models' ? new Response(JSON.stringify([{id:'author/other'}]),{headers:{link:'<https://huggingface.co/api/models?cursor=more>; rel="next"'}}) : Response.json({...metadata,tags:['sdxl']}))
  try { const page=await browseCompatible('all'); expect(page.results).toEqual([]); expect(page.nextCursor).toBe('more'); expect(inspectModel(metadata).result.downloads).toBeNull() } finally {vi.unstubAllGlobals()}
})
