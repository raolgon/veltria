import { open, stat, realpath } from 'node:fs/promises'
import { join, dirname, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { videoMetadataSchema, type Settings, type VideoComponent, type VideoMetadata } from '@veltria/contracts'
import { videoFiles } from '@veltria/core'
const exec = promisify(execFile)

export async function existingVideoComponents(binding: Settings['engineBinding']): Promise<VideoComponent[]> {
  return Promise.all(videoFiles.map(async file => {
    const path = binding ? join(binding.directory, 'models', file.folder, file.filename) : ''
    const result: VideoComponent = { role: file.role, filename: file.filename, path, bytes: null, modified: null, status: 'missing' }
    if (!path) return result
    try {
      const info = await stat(path); result.bytes = info.size; result.modified = info.mtimeMs
      if (!info.isFile()) { result.status = 'invalid'; return result }
      // Read bounded safetensors metadata only. Never read a 20 GB checkpoint into RAM.
      const handle = await open(path, 'r')
      try {
        const size = Buffer.alloc(8); if ((await handle.read(size, 0, 8, 0)).bytesRead !== 8) throw new Error()
        const length = Number(size.readBigUInt64LE())
        if (!Number.isSafeInteger(length) || length < 2 || length > 16 * 1024 ** 2 || length + 8 >= info.size) throw new Error()
        const header = Buffer.alloc(length)
        if ((await handle.read(header, 0, length, 8)).bytesRead !== length) throw new Error()
        const metadata = JSON.parse(header.toString('utf8'))
        const tensors = Object.entries(metadata).filter(([name]) => name !== '__metadata__')
        if (!tensors.length) throw new Error()
        for (const [, tensor] of tensors as [string, any][]) {
          if (typeof tensor.dtype !== 'string' || !Array.isArray(tensor.shape) || !tensor.shape.every((v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0) || !Array.isArray(tensor.data_offsets) || tensor.data_offsets.length !== 2 || !tensor.data_offsets.every((v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0) || tensor.data_offsets[1] < tensor.data_offsets[0] || tensor.data_offsets[1] > info.size - length - 8) throw new Error()
        }
        result.path = await realpath(path); result.status = 'present'
      } finally { await handle.close() }
    } catch (error) { result.status = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'invalid' }
    return result
  }))
}
export function validateVideoNodes(nodes: any) {
  const choices = (node: string, input: string): string[] => { const spec = nodes[node]?.input?.required?.[input]; return Array.isArray(spec?.[0]) ? spec[0] : spec?.[0] === 'COMBO' && Array.isArray(spec[1]?.options) ? spec[1].options : [] }
  const expected = [['UNETLoader', 'unet_name', videoFiles[0].filename], ['CLIPLoader', 'clip_name', videoFiles[1].filename], ['VAELoader', 'vae_name', videoFiles[2].filename], ['VAELoader', 'vae_name', videoFiles[3].filename], ['CLIPLoader', 'type', 'minimax']] as const
  for (const [node, input, value] of expected) if (!choices(node, input)?.includes(value)) throw new Error('El motor no pudo reconocer el perfil de video. Comprueba sus componentes existentes.')
  if (!choices('KSamplerSelect', 'sampler_name')?.includes('res_multistep')) throw new Error('El motor no admite el muestreador del perfil de video.')
}
/** PyAV is already required by ComfyUI video. Fixed read-only script, no downloads or shell. */
export async function inspectVideoFile(path: string, python: string): Promise<VideoMetadata> {
  const info = await stat(path)
  if (!info.isFile() || info.size > 256 * 1024 ** 2 || info.size < 32) throw new Error('El archivo de video tiene un tamaño no admitido.')
  const file = await open(path, 'r')
  try { const header = Buffer.alloc(12); await file.read(header, 0, 12, 0); if (header.toString('ascii', 4, 8) !== 'ftyp') throw new Error('El motor no devolvió un MP4 válido.') } finally { await file.close() }
  const env: NodeJS.ProcessEnv = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
  if (process.platform === 'win32') {
    const config = await readFile(join(dirname(dirname(python)), 'pyvenv.cfg'), 'utf8').catch(() => '')
    const base = /^home\s*=\s*(.+)$/m.exec(config)?.[1]?.trim()
    if (base && isAbsolute(base)) env.PATH = [base, join(base, 'Library', 'bin'), join(base, 'DLLs'), dirname(python), process.env.PATH].filter(Boolean).join(';')
  }
  const script = 'import av,json,sys\nc=av.open(sys.argv[1],options={"protocol_whitelist":"file"})\nv=c.streams.video[0]\nd=float(v.duration*v.time_base) if v.duration is not None else float(c.duration/av.time_base)\nprint(json.dumps({"width":v.width,"height":v.height,"duration":d,"fps":float(v.average_rate),"frames":v.frames,"codec":v.codec_context.name,"audio":bool(c.streams.audio)}))\nc.close()'
  const result = await exec(python, ['-B', '-I', '-c', script, path], { env, shell: false, windowsHide: true, timeout: 15_000, maxBuffer: 64_000 })
  return videoMetadataSchema.parse(JSON.parse(result.stdout))
}
