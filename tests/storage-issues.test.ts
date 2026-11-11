import { test, expect } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, writeFile, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storageBudget, storageFailure, storagePermission, probeStorageWrite } from '../apps/local-service/src/storage-issues'

test.each([['ENOSPC','disk-full'],['SQLITE_FULL','disk-full'],['EDQUOT','quota'],['EROFS','read-only'],['EACCES','permission-denied'],['EPERM','permission-denied']])('%s has an actionable storage error', (code, expected) => {
  const issue = storageFailure(Object.assign(new Error(code), { code }), '/models', 'models')!
  expect(issue.code).toBe(expected); expect(issue.path).toBe('/models'); expect(issue.target).toBe('models'); expect(issue.message).toContain('se conservan los archivos')
})
test('storage limits distinguish a blocking deficit from a non-blocking warning', () => {
  expect(storageFailure(Object.assign(new Error('database or disk is full'), {code:'SQLITE_FULL'}),'/data','data')?.code).toBe('disk-full')
  expect(storageFailure(Object.assign(new Error('attempt to write a readonly database'), {code:'SQLITE_READONLY'}),'/data','data')?.code).toBe('read-only')
  const required = 2 * 1024 ** 3
  expect(storageBudget('/models','models',required,required-1)[0].severity).toBe('error')
  expect(storageBudget('/models','models',required,required)[0].severity).toBe('warning')
  expect(storageBudget('/models','models',required,required+512*1024**2)).toEqual([])
  expect(storageBudget('/models','models',required,null)[0].code).toBe('space-unknown')
  expect(storageFailure(new Error('network disconnected'),'/models','models')).toBeNull()
})
test('preflight never creates folders; authorized write probe cleans up and preserves existing files', async () => {
  const root = await mkdtemp(join(tmpdir(),'veltria-permissions-'))
  try {
    await writeFile(join(root,'keep'),'existing data')
    expect(await storagePermission(join(root,'future','models'),'models')).toBeNull()
    expect(await readdir(root)).toEqual(['keep'])
    await probeStorageWrite(root,new AbortController().signal)
    expect(await readdir(root)).toEqual(['keep']); expect(await readFile(join(root,'keep'),'utf8')).toBe('existing data')
    const abort = new AbortController(); abort.abort()
    await expect(probeStorageWrite(root,abort.signal)).rejects.toThrow()
    expect(await readdir(root)).toEqual(['keep'])
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
      const denied = join(root,'denied'); await mkdir(denied); await chmod(denied,0o500)
      try {
        expect((await storagePermission(denied,'models'))?.code).toBe('permission-denied')
        await expect(probeStorageWrite(denied,new AbortController().signal)).rejects.toMatchObject({code:'EACCES'})
      } finally { await chmod(denied,0o700) }
    }
  } finally { await rm(root,{recursive:true,force:true}) }
})
