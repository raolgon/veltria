// Acceptance helper. No server endpoint invokes this script.
import { probeStorageWrite, storageFailure } from '../apps/local-service/src/storage-issues'
const directory = process.argv[2]
if (!directory) throw new Error('Supply the disposable acceptance folder')
try { await probeStorageWrite(directory, new AbortController().signal); console.log(JSON.stringify({ writable: true })) }
catch (error) { const issue = storageFailure(error, directory, 'models'); if (!issue) throw error; console.log(JSON.stringify({ writable: false, issue })) }
