import { createHash } from 'node:crypto'
import { lstat, realpath, unlink } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path'
import type { StoredFile } from '@veltria/contracts'
import { hashFile } from '../../../packages/adapters/src/profile-download'
export type StorageSource = {path:string;bytes:number;sha256:string;kind:'checkpoint'|'lora';profile:{id:string;name:string;configurationId:string}}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const samePath = (a:string,b:string) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
function within(parent:string,file:string) { const part=relative(parent,file);return !part || !isAbsolute(part) && part !== '..' && !part.startsWith('..'+(process.platform==='win32'?'\\':'/')) }
export class ModelStorage {
  constructor(private directory:string,private binding:string|null,private sources:StorageSource[]) {}
  private async scan() {
    const root = resolve(this.directory), canonicalRoot = await realpath(root).catch(()=>null)
    const engine = this.binding ? await realpath(this.binding).catch(()=>resolve(this.binding!)) : null
    const records = new Map<string,{file:StoredFile;fingerprint:unknown;sha256:string}>()
    for (const source of this.sources) {
      if (basename(source.path) !== basename(source.path.replace(/\\/g,'/')) || !samePath(dirname(source.path),join(root,source.kind==='lora'?'loras':'checkpoints'))) continue
      for (const partial of [false,true]) {
        const path = source.path + (partial?'.part':'')
        let info
        try {info=await lstat(path)} catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error}
        const id=digest(path), previous=records.get(id)
        if(previous){if(!previous.file.profiles.some(item=>item.id===source.profile.id))previous.file.profiles.push(source.profile);continue}
        const parent = await realpath(dirname(path)).catch(()=>null)
        let protectedReason:string|null=null
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || !canonicalRoot || !samePath(root,canonicalRoot) || !parent || !samePath(parent,dirname(path))) protectedReason='Los enlaces y archivos no regulares se conservan. Gestiona el archivo original fuera de Veltria.'
        else if(engine && within(engine,path)) protectedReason='Este archivo pertenece a la instalación externa de ComfyUI y se conserva intacto.'
        else if(!partial && info.size !== source.bytes) protectedReason='El archivo tiene un tamaño distinto al del catálogo y se conserva intacto.'
        const file:StoredFile={id,path,name:basename(path),bytes:info.size,expectedBytes:source.bytes,kind:partial?'partial':source.kind,profiles:[source.profile],protectedReason}
        records.set(id,{file,fingerprint:{dev:info.dev,ino:info.ino,size:info.size,mtime:info.mtimeMs,ctime:info.ctimeMs,birth:info.birthtimeMs,nlink:info.nlink},sha256:source.sha256})
      }
    }
    return records
  }
  async inventory(busy:boolean) {
    const files=[...(await this.scan()).values()].map(item=>item.file)
    return {directory:this.directory,totalBytes:files.reduce((sum,file)=>sum+file.bytes,0),partialBytes:files.filter(file=>file.kind==='partial').reduce((sum,file)=>sum+file.bytes,0),files,busy}
  }
  private async snapshot(id:string) {
    const record=(await this.scan()).get(id)
    if(!record)throw new Error('El archivo ya no está en esta ubicación. Actualiza la lista.')
    const revision=digest({directory:this.directory,binding:this.binding,...record})
    return {...record,revision}
  }
  async plan(id:string) {
    const record=await this.snapshot(id)
    return {file:record.file,revision:record.revision,shared:record.file.profiles.length>1,canRemove:!record.file.protectedReason}
  }
  async remove(id:string,revision:string,acceptShared:boolean) {
    const before=await this.snapshot(id)
    if(before.revision!==revision)throw new Error('El archivo o su ubicación cambiaron. Revisa de nuevo la retirada.')
    if(before.file.protectedReason)throw new Error(before.file.protectedReason)
    if(before.file.profiles.length>1&&!acceptShared)throw new Error('Confirma los perfiles afectados antes de retirar un archivo compartido.')
    if(before.file.kind!=='partial'&&await hashFile(before.file.path)!==before.sha256)throw new Error('El SHA-256 no coincide con el catálogo. El archivo se conserva intacto.')
    const after=await this.snapshot(id)
    if(after.revision!==revision)throw new Error('El archivo o su ubicación cambiaron. Revisa de nuevo la retirada.')
    await unlink(after.file.path) // Exact reviewed file only. No directory removal or dependency cascade.
    return after.file
  }
}
