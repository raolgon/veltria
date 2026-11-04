import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
const require = createRequire(import.meta.url)
try { require('electron') } catch {
  const result = spawnSync(process.execPath, [require.resolve('electron/install.js')], { stdio: 'inherit', shell: false })
  if (result.status !== 0) process.exit(result.status || 1)
}
