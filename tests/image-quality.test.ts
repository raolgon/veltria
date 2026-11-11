import { test, expect } from 'vitest'
import { imageQualityLimits, qualityDimensions, validImageQuality, classifyJobFailure, reduceImageQuality, sdxlProfile } from '@veltria/core'
import { createImageSchema } from '@veltria/contracts'
test('direct-generation bounds vary by family and preserve legacy requests', () => {
 expect(createImageSchema.parse({ requestId: crypto.randomUUID(), prompt: 'test' }).quality).toBeUndefined()
 expect(imageQualityLimits().max).toBe(1024)
 expect(imageQualityLimits(sdxlProfile).max).toBe(1536)
 expect(validImageQuality({ width: 1536, height: 1024, steps: 40, cfg: 6 }, sdxlProfile)).toBe(true)
 expect(validImageQuality({ width: 1536, height: 1024, steps: 40, cfg: 6 })).toBe(false)
 expect(validImageQuality({ width: 256, height: 512, steps: 20, cfg: 7 }, sdxlProfile)).toBe(false)
 for (const size of [512, 768, 1024, 1536]) {
  const [width, height] = qualityDimensions(size, 'portrait')
  expect(width % 64).toBe(0); expect(height).toBe(size); expect(width).toBeLessThan(height)
 }
})

test('classifyJobFailure separates memory, incompatibility, engine availability and internal execution errors', () => {
 const oom = classifyJobFailure({ exceptionType: 'torch.cuda.OutOfMemoryError', exceptionMessage: 'CUDA out of memory. Tried to allocate 1.50 GiB', nodeType: 'KSampler' })
 expect(oom.kind).toBe('memory')
 expect(oom.node).toBe('KSampler')
 expect(oom.detail).toContain('CUDA out of memory')

 const incompatible = classifyJobFailure({ exceptionType: 'RuntimeError', exceptionMessage: 'mat1 and mat2 shapes cannot be multiplied (154x768 and 2048x1280)', nodeType: 'CLIPTextEncode' })
 expect(incompatible.kind).toBe('incompatible')
 expect(incompatible.message).not.toContain('memoria')

 const unavailable = classifyJobFailure({ errorMessage: 'fetch failed: ECONNREFUSED 127.0.0.1' })
 expect(unavailable.kind).toBe('engine-unavailable')
 expect(unavailable.message).not.toContain('memoria')

 const internal = classifyJobFailure({ exceptionType: 'ValueError', exceptionMessage: 'Unexpected NaN in tensor', traceback: 'File "nodes.py", line 42' })
 expect(internal.kind).toBe('execution')
 expect(internal.message).not.toContain('memoria')
 expect(internal.detail).toContain('Unexpected NaN')
})

test('reduceImageQuality proposes concrete, reviewable reductions for memory recovery', () => {
 expect(reduceImageQuality({ width: 1024, height: 1024, steps: 30, cfg: 6.5, format: 'square' }, undefined, 20, 7)).toEqual({ width: 512, height: 512, steps: 20, cfg: 6.5 })
 expect(reduceImageQuality({ width: 1024, height: 768, steps: 24, cfg: 7, format: 'landscape' }, sdxlProfile, 20, 7)).toEqual({ width: 768, height: 576, steps: 20, cfg: 7 })
 expect(reduceImageQuality({ width: 512, height: 512, steps: 20, cfg: 7, format: 'square' }, undefined, 20, 7)).toEqual({ width: 384, height: 384, steps: 20, cfg: 7 })
 expect(reduceImageQuality({ width: 768, height: 768, steps: 20, cfg: 7, format: 'square' }, sdxlProfile, 20, 7)).toEqual({ width: 640, height: 640, steps: 20, cfg: 7 })
 expect(reduceImageQuality({ width: 256, height: 256, steps: 20, cfg: 7, format: 'square' }, undefined, 20, 7)).toEqual({ width: 256, height: 256, steps: 12, cfg: 7 })
 expect(reduceImageQuality({ width: 256, height: 256, steps: 12, cfg: 7, format: 'square' }, undefined, 20, 7)).toBeNull()
})

