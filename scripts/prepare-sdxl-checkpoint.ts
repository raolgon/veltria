// Explicit opt-in, after reviewing the pinned SDXL plan/license. No engine or package installation.
import { mkdir, statfs } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { sdxlProfile } from '@veltria/core'
import { downloadProfileFile, finishProfileFile, fileBytes } from '../packages/adapters/src/profile-download'
const directory=process.argv[2]
if(!directory || !isAbsolute(directory) || process.argv[3]!=='--authorize-sdxl')throw new Error('Usage: prepare-sdxl-checkpoint ABSOLUTE_MODELS_DIRECTORY --authorize-sdxl')
const folder=join(directory,'checkpoints');await mkdir(folder,{recursive:true})
const destination=join(folder,sdxlProfile.filename),existing=await fileBytes(destination),partial=await fileBytes(destination+'.part')
if(existing && existing!==sdxlProfile.bytes)throw new Error('An existing different file is preserved.')
const disk=await statfs(folder)
if(disk.bavail*disk.bsize < sdxlProfile.bytes-Math.min(sdxlProfile.bytes,existing||partial)+512*1024**2)throw new Error('Not enough free space for the remaining download and work margin.')
const controller=new AbortController();process.on('SIGINT',()=>controller.abort())
let last=0
console.log(JSON.stringify({kind:'authorized-sdxl-download',source:sdxlProfile.source,license:sdxlProfile.license,bytes:sdxlProfile.bytes,sha256:sdxlProfile.sha256,destination}))
if(!existing)await downloadProfileFile(sdxlProfile,destination,controller.signal,(received,restart)=>{if(Date.now()-last>5000||received===sdxlProfile.bytes){last=Date.now();console.log(JSON.stringify({received,total:sdxlProfile.bytes,restart}))}})
await finishProfileFile(sdxlProfile,destination,controller.signal)
console.log('SDXL CHECKPOINT PASS: complete pinned file, SHA-256 verified. No generation has been certified yet.')
