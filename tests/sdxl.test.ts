import { test, expect } from 'vitest'
import { sdxlProfile, configurationsFor, profileDimensions, recommendImage } from '@veltria/core'
import { inspectModel } from '../apps/local-service/src/discovery'
import { fixtureHardware } from './creation-fixture'
test('SDXL is separately identified with conservative dimensions and resource requirements',()=>{
 expect(configurationsFor(sdxlProfile).every(item=>item.configuration.recipe==='sdxl-text-to-image-v1')).toBe(true)
 expect(profileDimensions('square',sdxlProfile)).toEqual([768,768])
 expect(profileDimensions('portrait',sdxlProfile)).toEqual([576,768])
 expect(profileDimensions('square')).toEqual([512,512])
 expect(recommendImage(fixtureHardware,sdxlProfile).level).toBe('limited')
 expect(recommendImage({...fixtureHardware,gpus:[{...fixtureHardware.gpus[0],vramTotal:4*1024**3}]},sdxlProfile).level).toBe('unsupported')
})

test('only the pinned official SDXL checkpoint is exposed by discovery',()=>{
 const metadata={id:'stabilityai/stable-diffusion-xl-base-1.0',sha:'462165984030d82259a11f4367a4eed129e94a7b',tags:[],siblings:[{rfilename:'sd_xl_base_1.0.safetensors',lfs:{sha256:sdxlProfile.sha256,size:sdxlProfile.bytes}}]}
 expect(inspectModel(metadata).result).toMatchObject({family:'SDXL',supported:true})
 expect(inspectModel({...metadata,sha:'a'.repeat(40)}).result.supported).toBe(false)
 expect(inspectModel({...metadata,siblings:[{rfilename:'other.safetensors',lfs:{sha256:'b'.repeat(64),size:sdxlProfile.bytes}}]}).result.supported).toBe(false)
})
