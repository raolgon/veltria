import { test, expect } from 'vitest'
import { inspectModel, verifyTensorHeader } from '../apps/local-service/src/discovery'
import { imageWorkflow } from '@veltria/core'
const metadata = { id: 'author/model', sha: 'a'.repeat(40), tags: ['text-to-image', 'base_model:runwayml/stable-diffusion-v1-5'], siblings: [{ rfilename: 'full.safetensors', lfs: { sha256: 'b'.repeat(64), size: 2000000 } }] }
test('discovery distinguishes runnable family, gated access, LoRA and incomplete files', () => {
  expect(inspectModel(metadata).result.supported).toBe(true)
  expect(inspectModel({ ...metadata, gated: 'manual' }).result.supported).toBe(false)
  expect(inspectModel({ ...metadata, tags: ['sdxl'] }).result.supported).toBe(false)
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
