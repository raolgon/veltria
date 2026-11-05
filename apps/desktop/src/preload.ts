import { contextBridge, ipcRenderer } from 'electron'
// Fixed native folder picker only; no generic IPC, filesystem or process access.
contextBridge.exposeInMainWorld('veltriaDesktop', Object.freeze({
  sandboxed: process.sandboxed,
  contextIsolated: process.contextIsolated,
  chooseEngineDirectory: () => ipcRenderer.invoke('veltria:choose-engine-directory')
}))
