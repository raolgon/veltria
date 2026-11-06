// Filesystem boundary check. Only tiny files in a newly created temporary directory are removed.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, link } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { ModelStorage } from '../apps/local-service/src/model-storage'
const root=await mkdtemp(join(tmpdir(),'Veltria native storage with spaces '))
try {
 await mkdir(join(root,'checkpoints'))
 const path=join(root,'checkpoints','fixture.safetensors'),body='native storage fixture only'
 await writeFile(path,body);await writeFile(join(root,'unrelated.txt'),'keep')
 const source={path,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex'),kind:'checkpoint' as const,profile:{id:'base',name:'Base',configurationId:'base-balanced'}}
 const manager=new ModelStorage(root,null,[source,{...source,profile:{id:'lora',name:'LoRA dependency',configurationId:'lora-balanced'}}])
 let inventory=await manager.inventory(false);assert.equal(inventory.files.length,1);assert.equal(inventory.totalBytes,source.bytes)
 const plan=await manager.plan(inventory.files[0].id)
 await assert.rejects(manager.remove(plan.file.id,plan.revision,false),/Confirma/)
 const external=new ModelStorage(root,root,[source]);assert.equal((await external.plan(plan.file.id)).canRemove,false)
 await link(path,join(root,'hardlink'));assert.equal((await manager.plan(plan.file.id)).canRemove,false);await rm(join(root,'hardlink'))
 const renewed=await manager.plan(plan.file.id);await manager.remove(renewed.file.id,renewed.revision,true)
 assert.equal((await manager.inventory(false)).files.length,0);assert.equal(await readFile(join(root,'unrelated.txt'),'utf8'),'keep')
 await writeFile(path,body);await writeFile(path+'.part','partial')
 inventory=await manager.inventory(false)
 const partial=await manager.plan(inventory.files.find(item=>item.kind==='partial')!.id);await manager.remove(partial.file.id,partial.revision,true)
 assert.equal(await readFile(path,'utf8'),body)
 const stale=await manager.plan((await manager.inventory(false)).files[0].id);await writeFile(path,'x'.repeat(source.bytes))
 await assert.rejects(manager.remove(stale.file.id,stale.revision,true),/cambiaron/)
 const corrupt=await manager.plan(stale.file.id);await assert.rejects(manager.remove(corrupt.file.id,corrupt.revision,true),/SHA-256/)
 console.log(`STORAGE FILESYSTEM PASS: ${process.platform}, Bun ${Bun.version}; shared consent, exact unlink, hash, stale plan, external protection, hard links, partials and unrelated files. Only temporary fixtures were used.`)
} finally { await rm(root,{recursive:true,force:true}) }
