import { test, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { ModelStorage } from '../apps/local-service/src/model-storage'
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'Veltria storage '));await mkdir(join(root,'checkpoints'))
 const file=join(root,'checkpoints','model.safetensors'),body='fixture weights';await writeFile(file,body)
 const source={path:file,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex'),kind:'checkpoint' as const,profile:{id:'base',name:'Base',configurationId:'base-balanced'}}
 return {root,file,source,manager:new ModelStorage(root,null,[source]),cleanup:()=>rm(root,{recursive:true,force:true})}
}
test('storage counts shared files once, requires explicit shared consent and removes exactly one file',async()=>{
 const f=await fixture();try{
  const manager=new ModelStorage(f.root,null,[f.source,{...f.source,profile:{id:'adaptation',name:'Adaptation',configurationId:'adaptation-balanced'}}])
  await writeFile(join(f.root,'checkpoints','unrelated.bin'),'keep')
  const inventory=await manager.inventory(false);expect(inventory.files).toHaveLength(1);expect(inventory.totalBytes).toBe(f.source.bytes)
  const plan=await manager.plan(inventory.files[0].id);expect(plan.shared).toBe(true)
  await expect(manager.remove(plan.file.id,plan.revision,false)).rejects.toThrow('Confirma')
  await manager.remove(plan.file.id,plan.revision,true)
  expect(await readFile(join(f.root,'checkpoints','unrelated.bin'),'utf8')).toBe('keep')
  expect((await manager.inventory(false)).files).toHaveLength(0)
 }finally{await f.cleanup()}
})
test('changed files, wrong hash and unknown ids never authorize deletion',async()=>{
 const f=await fixture();try{
  const file=(await f.manager.inventory(false)).files[0],plan=await f.manager.plan(file.id)
  await writeFile(f.file,'x'.repeat(f.source.bytes))
  await expect(f.manager.remove(file.id,plan.revision,false)).rejects.toThrow('cambiaron')
  const fresh=await f.manager.plan(file.id)
  await expect(f.manager.remove(file.id,fresh.revision,false)).rejects.toThrow('SHA-256')
  await expect(f.manager.plan('0'.repeat(64))).rejects.toThrow('ya no está')
  expect(await readFile(f.file,'utf8')).toBe('x'.repeat(f.source.bytes))
 }finally{await f.cleanup()}
})
test('external engine folders, symlinks and hard links are protected; partials can be retired independently',async()=>{
 const f=await fixture();try{
  const external=new ModelStorage(f.root,f.root,[f.source]);expect((await external.inventory(false)).files[0].protectedReason).toContain('ComfyUI')
  await link(f.file,join(f.root,'other-copy'));expect((await f.manager.inventory(false)).files[0].protectedReason).toContain('enlaces')
  await rm(join(f.root,'other-copy'));await symlink(f.file,f.file+'.part')
  let inventory=await f.manager.inventory(false);expect(inventory.files.find(item=>item.kind==='partial')?.protectedReason).toContain('enlaces')
  await rm(f.file+'.part');await writeFile(f.file+'.part','prefix')
  inventory=await f.manager.inventory(false);const partial=inventory.files.find(item=>item.kind==='partial')!
  const plan=await f.manager.plan(partial.id);await f.manager.remove(partial.id,plan.revision,false)
  expect(await readFile(f.file,'utf8')).toBe('fixture weights')
 }finally{await f.cleanup()}
})

test('a linked parent directory cannot redirect removal to another location',async()=>{
 const f=await fixture();try{
  await rename(join(f.root,'checkpoints'),join(f.root,'external'))
  await symlink(join(f.root,'external'),join(f.root,'checkpoints'),'dir')
  const file=(await f.manager.inventory(false)).files[0],plan=await f.manager.plan(file.id)
  expect(plan.canRemove).toBe(false)
  await expect(f.manager.remove(file.id,plan.revision,false)).rejects.toThrow('enlaces')
  expect(await readFile(join(f.root,'external','model.safetensors'),'utf8')).toBe('fixture weights')
 }finally{await f.cleanup()}
})
