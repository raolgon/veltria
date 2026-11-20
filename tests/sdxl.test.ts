import { test, expect } from 'vitest'
import { starterProfile, sdxlProfile, configurationsFor, profileDimensions, recommendImage, translate } from '@veltria/core'
import { inspectModel } from '../apps/local-service/src/discovery'
import { fixtureHardware } from './creation-fixture'

const GiB = 1024 ** 3

test('SDXL is separately identified with conservative dimensions and resource requirements', () => {
  expect(configurationsFor(sdxlProfile).every(item => item.configuration.recipe === 'sdxl-text-to-image-v1')).toBe(true)
  expect(profileDimensions('square', sdxlProfile)).toEqual([768, 768])
  expect(profileDimensions('portrait', sdxlProfile)).toEqual([576, 768])
  expect(profileDimensions('square')).toEqual([512, 512])
  expect(recommendImage(fixtureHardware, sdxlProfile).level).toBe('limited')
  expect(recommendImage({ ...fixtureHardware, gpus: [{ ...fixtureHardware.gpus[0], vramTotal: 4 * GiB }] }, sdxlProfile).level).toBe('unsupported')
})

test('only the pinned official SDXL checkpoint is exposed by discovery', () => {
  const metadata = { id: 'stabilityai/stable-diffusion-xl-base-1.0', sha: '462165984030d82259a11f4367a4eed129e94a7b', tags: [], siblings: [{ rfilename: 'sd_xl_base_1.0.safetensors', lfs: { sha256: sdxlProfile.sha256, size: sdxlProfile.bytes } }] }
  expect(inspectModel(metadata).result).toMatchObject({ family: 'SDXL', supported: true })
  expect(inspectModel({ ...metadata, sha: 'a'.repeat(40) }).result.supported).toBe(false)
  expect(inspectModel({ ...metadata, siblings: [{ rfilename: 'other.safetensors', lfs: { sha256: 'b'.repeat(64), size: sdxlProfile.bytes } }] }).result.supported).toBe(false)
})

test('hardware recommendation matrix (fixtures only) separates minimums, low free memory, uncertainty, and unsupported systems', () => {
  const gpu = fixtureHardware.gpus[0]

  // Minimum supported SD 1.5 hardware (nominal 4 GB VRAM / 8 GB RAM reported slightly below nominal)
  const minimalSd15 = recommendImage({
    ...fixtureHardware,
    platform: 'linux',
    ram: { ...fixtureHardware.ram, total: 7.5 * GiB, available: 3 * GiB },
    gpus: [{ ...gpu, vramTotal: 3.8 * GiB, vramAvailable: 3 * GiB }]
  }, starterProfile)
  expect(minimalSd15.level).toBe('recommended')

  // Below minimum VRAM or RAM for SD 1.5
  const lowVramSd15 = recommendImage({ ...fixtureHardware, gpus: [{ ...gpu, vramTotal: 2 * GiB, vramAvailable: 2 * GiB }] }, starterProfile)
  expect(lowVramSd15.level).toBe('unsupported')

  const lowRamSd15 = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, total: 6 * GiB, available: 3 * GiB } }, starterProfile)
  expect(lowRamSd15.level).toBe('unsupported')

  // Meets nominal minimums, but low free RAM or low free VRAM -> limited
  const lowFreeRam = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: 1 * GiB } }, starterProfile)
  expect(lowFreeRam.level).toBe('limited')
  expect(lowFreeRam.reason).toContain('poca memoria libre')

  const lowFreeVram = recommendImage({ ...fixtureHardware, gpus: [{ ...gpu, vramAvailable: 1.5 * GiB }] }, starterProfile)
  expect(lowFreeVram.level).toBe('limited')
  expect(lowFreeVram.reason).toContain('poca memoria libre')

  // Missing free RAM reading -> limited with explicit uncertainty instead of claiming RAM is full
  const unreadableFreeRam = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: null } }, starterProfile)
  expect(unreadableFreeRam.level).toBe('limited')
  expect(unreadableFreeRam.reason).toContain('no se pudo leer la memoria RAM libre')

  // Unknown hardware readings (no NVIDIA GPU, AMD-only, null VRAM, or null total RAM) -> unknown
  const noGpu = recommendImage({ ...fixtureHardware, gpus: [] }, starterProfile)
  expect(noGpu.level).toBe('unknown')

  const amdGpu = recommendImage({ ...fixtureHardware, gpus: [{ ...gpu, name: 'AMD Radeon RX 6700 XT' }] }, starterProfile)
  expect(amdGpu.level).toBe('unknown')

  const nullVram = recommendImage({ ...fixtureHardware, gpus: [{ ...gpu, vramTotal: null, vramAvailable: null }] }, starterProfile)
  expect(nullVram.level).toBe('unknown')

  const nullTotalRam = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, total: null, available: null } }, starterProfile)
  expect(nullTotalRam.level).toBe('unknown')
  expect(recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, total: null, available: null } }, sdxlProfile).level).toBe('unknown')

  // SDXL below minimum RAM (< 14 GiB) or VRAM (< 5.5 GiB) -> unsupported; meeting minimums -> limited
  const sdxlLowRam = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, total: 12 * GiB, available: 6 * GiB } }, sdxlProfile)
  expect(sdxlLowRam.level).toBe('unsupported')

  const sdxlLowVram = recommendImage({ ...fixtureHardware, gpus: [{ ...gpu, vramTotal: 5 * GiB }] }, sdxlProfile)
  expect(sdxlLowVram.level).toBe('unsupported')

  const sdxlMinimal = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, total: 15 * GiB, available: 6 * GiB }, gpus: [{ ...gpu, vramTotal: 5.8 * GiB }] }, sdxlProfile)
  expect(sdxlMinimal.level).toBe('limited')
  expect(sdxlMinimal.reason.startsWith('SDXL ')).toBe(true)

  const sdxlUnreadableFreeRam = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: null } }, sdxlProfile)
  expect(sdxlUnreadableFreeRam.level).toBe('limited')
  expect(sdxlUnreadableFreeRam.reason.startsWith('SDXL ')).toBe(true)
  expect(sdxlUnreadableFreeRam.reason).toContain('no se pudo leer la memoria RAM libre')

  const sdxlLowFreeRam = recommendImage({ ...fixtureHardware, ram: { ...fixtureHardware.ram, available: 2 * GiB } }, sdxlProfile)
  expect(sdxlLowFreeRam.level).toBe('limited')
  expect(sdxlLowFreeRam.reason.startsWith('SDXL ')).toBe(true)
  expect(sdxlLowFreeRam.reason).toContain('queda poca memoria libre')

  const sdxlLowFreeVram = recommendImage({ ...fixtureHardware, gpus: [{ ...gpu, vramAvailable: 1.5 * GiB }] }, sdxlProfile)
  expect(sdxlLowFreeVram.level).toBe('limited')
  expect(sdxlLowFreeVram.reason).toContain('queda poca memoria libre')

  // Unsupported platform (macOS) for both SD 1.5 and SDXL
  const macSd15 = recommendImage({ ...fixtureHardware, platform: 'darwin' }, starterProfile)
  const macSdxl = recommendImage({ ...fixtureHardware, platform: 'darwin' }, sdxlProfile)
  expect(macSd15.level).toBe('unsupported')
  expect(macSdxl.level).toBe('unsupported')
  expect(macSdxl.reason).toContain('SDXL')

  // Every matrix reason translates cleanly into English
  for (const result of [minimalSd15, lowVramSd15, lowFreeRam, unreadableFreeRam, noGpu, nullTotalRam, sdxlLowRam, sdxlMinimal, sdxlUnreadableFreeRam, sdxlLowFreeRam, macSd15, macSdxl]) {
    expect(translate(result.reason, 'en'), `missing English translation for "${result.reason}"`).not.toBe(result.reason)
  }
})
