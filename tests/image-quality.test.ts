import { test, expect } from 'vitest'
import { imageQualityLimits, qualityDimensions, validImageQuality, sdxlProfile } from '@veltria/core'
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
