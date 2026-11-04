import os from 'node:os'
import { join, resolve } from 'node:path'
export function dataDirectory(): string {
  if (process.env.VELTRIA_DATA_DIR) return resolve(process.env.VELTRIA_DATA_DIR)
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local'), 'Veltria')
  if (process.platform === 'darwin') return join(os.homedir(), 'Library', 'Application Support', 'Veltria')
  return join(process.env.XDG_DATA_HOME || join(os.homedir(), '.local', 'share'), 'veltria')
}
