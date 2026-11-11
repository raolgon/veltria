import { access, open, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import type { StorageIssue } from '@veltria/contracts'
type Target = StorageIssue['target']
export function storageFailure(error: unknown, path: string, target: Target): StorageIssue | null {
  const context = error as { storagePath?: string; storageTarget?: Target } | null
  path = context?.storagePath || path; target = context?.storageTarget || target
  const code = (error as NodeJS.ErrnoException | null)?.code
  const detail = error instanceof Error ? error.message : ''
  let kind: StorageIssue['code']
  if (code === 'EDQUOT' || /disk quota|quota exceeded|EDQUOT/i.test(detail)) kind = 'quota'
  else if (code === 'ENOSPC' || code === 'SQLITE_FULL' || /ENOSPC|SQLITE_FULL|no space|disk (?:is )?full|not enough space/i.test(detail)) kind = 'disk-full'
  else if (code === 'EROFS' || String(code).startsWith('SQLITE_READONLY') || /read.only file system|write.protected/i.test(detail)) kind = 'read-only'
  else if (code === 'EACCES' || code === 'EPERM' || /permission denied|access is denied|operation not permitted/i.test(detail)) kind = 'permission-denied'
  else return null
  const message = kind === 'disk-full' ? 'Se agotó el espacio. Libera espacio o elige otra ubicación y revisa el plan para continuar; se conservan los archivos.'
    : kind === 'quota' ? 'Se alcanzó la cuota de almacenamiento. Libera espacio de tu cuota o elige otra carpeta; se conservan los archivos.'
    : kind === 'read-only' ? 'La ubicación es de sólo lectura. Elige una carpeta donde puedas escribir; se conservan los archivos.'
    : 'No se puede escribir o ejecutar en esta ubicación. Revisa sus permisos o elige otra carpeta y vuelve a revisar el plan; se conservan los archivos.'
  return { code: kind, severity: 'error', target, path, message, requiredBytes: null, availableBytes: null }
}
export function dataStorageError(error: unknown, directory: string): never {
  if (error instanceof Error) Object.assign(error, { storagePath: directory, storageTarget: 'data' })
  throw error
}
export function storageBudget(path: string, target: Target, required: number, available: number | null): StorageIssue[] {
  const base = { path, target, requiredBytes: required, availableBytes: available }
  if (available === null) return [{ ...base, code: 'space-unknown', severity: 'error', message: 'No se pudo comprobar el espacio de esta ubicación. Elige otra carpeta accesible.' }]
  if (available < required) return [{ ...base, code: 'disk-full', severity: 'error', message: 'No hay espacio suficiente para completar la preparación y conservar sus archivos temporales. Libera espacio o elige otra carpeta.' }]
  if (available - required < Math.max(256 * 1024 ** 2, Math.ceil(required * .1))) return [{ ...base, code: 'low-space', severity: 'warning', message: 'Quedará poco espacio libre después de preparar. Libera espacio o elige otra carpeta para tener más margen.' }]
  return []
}
// Read-only preflight. Windows access() cannot certify every ACL; the authorized
// write probe below is the final check, before any network download is started.
export async function storagePermission(path: string, target: Target): Promise<StorageIssue | null> {
  for (let current = path;; current = dirname(current)) {
    try { await access(current, constants.W_OK | constants.X_OK); return null }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && dirname(current) !== current) continue
      const issue = storageFailure(error, path, target)
      if (issue) return issue
      throw error
    }
  }
}
export async function probeStorageWrite(directory: string, signal: AbortSignal) {
  signal.throwIfAborted()
  const probe = join(directory, `.veltria-write-check-${randomUUID()}`)
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(probe, 'wx', 0o600)
    await handle.writeFile('Veltria storage check'); await handle.sync(); signal.throwIfAborted()
    await handle.close(); handle = undefined
    await unlink(probe)
  } catch (error) {
    if (handle) { await handle.close().catch(() => {}); await unlink(probe).catch(() => {}) }
    throw error
  }
}
