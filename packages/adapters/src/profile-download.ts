import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, open, rename, stat, unlink } from 'node:fs/promises'
import type { ImageProfile } from '@veltria/core'

export async function fileBytes(path: string): Promise<number> {
  try { const entry = await lstat(path); if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('La ubicación contiene un enlace o un archivo no regular. Elige otra carpeta.'); return entry.size }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error }
}
export async function hashFile(path: string, signal?: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(path, { highWaterMark: 1024 * 1024, signal })
  for await (const chunk of stream) hash.update(chunk)
  return hash.digest('hex')
}
async function trustedResponse(url: string, init: RequestInit, allowLocalFixture: boolean): Promise<Response> {
  let current = url
  for (let i = 0; i < 6; i++) {
    const parsed = new URL(current)
    const trusted = parsed.protocol === 'https:' && (parsed.hostname === 'huggingface.co' || parsed.hostname.endsWith('.huggingface.co') || parsed.hostname.endsWith('.hf.co') || parsed.hostname.endsWith('.xethub.hf.co'))
    if (!(trusted || allowLocalFixture && parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1') || parsed.username || parsed.password) throw new Error('El origen de descarga no está admitido por este perfil.')
    const response = await fetch(current, { ...init, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location'); await response.body?.cancel()
      if (!location) throw new Error('El origen devolvió una redirección incompleta.')
      current = new URL(location, current).href; continue
    }
    return response
  }
  throw new Error('El origen devolvió demasiadas redirecciones.')
}
export async function downloadProfileFile(profile: ImageProfile, destination: string, signal: AbortSignal, progress: (bytes: number, restart: boolean) => void, allowLocalFixture = false) {
  const partial = `${destination}.part`
  let received = await fileBytes(partial)
  if (received > profile.bytes) { await unlink(partial); received = 0 }
  if (received === profile.bytes) return
  const response = await trustedResponse(profile.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(24 * 60 * 60 * 1000)]), headers: { accept: 'application/octet-stream', 'accept-encoding': 'identity', ...(received ? { Range: `bytes=${received}-` } : {}) } }, allowLocalFixture)
  if (response.status !== 200 && response.status !== 206) { await response.body?.cancel(); throw new Error(`No se pudo descargar el perfil (HTTP ${response.status}). Vuelve a intentarlo; se conserva la parte recuperable.`) }
  const range = response.headers.get('content-range')
  if (response.status === 206 && range !== `bytes ${received}-${profile.bytes - 1}/${profile.bytes}`) { await response.body?.cancel(); throw new Error('El origen devolvió un rango inesperado. La parte descargada se conserva.') }
  const restart = response.status === 200 && received > 0
  if (response.status === 200) received = 0
  const expected = response.headers.get('content-length')
  if (expected !== null && Number(expected) !== profile.bytes - received) { await response.body?.cancel(); throw new Error('El tamaño anunciado por el origen cambió. No se ha sustituido el archivo del perfil.') }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('El origen no entregó el archivo.')
  const handle = await open(partial, received ? 'a' : 'w', 0o600)
  progress(received, restart)
  try {
    for (;;) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      if (received + value.byteLength > profile.bytes) throw new Error('El archivo supera el tamaño declarado; se detuvo la descarga.')
      let offset = 0
      while (offset < value.length) { const write = await handle.write(value, offset, value.length - offset); if (!write.bytesWritten) throw new Error('No se pudo escribir en disco.'); offset += write.bytesWritten }
      received += value.byteLength; progress(received, false)
    }
    await handle.sync()
    if (received !== profile.bytes) throw new Error('La descarga quedó incompleta. Puedes continuarla sin perder los bytes recibidos.')
  } finally { await reader.cancel().catch(() => {}); await handle.close() }
}
export async function finishProfileFile(profile: ImageProfile, destination: string, signal: AbortSignal) {
  const existing = await fileBytes(destination)
  if (existing) {
    if (existing !== profile.bytes || await hashFile(destination, signal) !== profile.sha256) throw new Error('Hay un archivo distinto en el destino del perfil. Se conserva intacto; elige otra ubicación.')
    return
  }
  const partial = `${destination}.part`
  if (await fileBytes(partial) !== profile.bytes) throw new Error('El archivo todavía no está completo.')
  if (await hashFile(partial, signal) !== profile.sha256) { await unlink(partial); throw new Error('La verificación SHA-256 falló. Se retiró únicamente la descarga temporal dañada; vuelve a preparar el perfil.') }
  // Never replace an existing checkpoint, including one created while verification was running.
  try { await stat(destination); throw new Error('El destino cambió durante la comprobación. Se conserva el archivo existente.') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  await rename(partial, destination)
}
