import { contextBridge } from 'electron'
// Read-only container diagnostics. No IPC, filesystem, shell or product operations.
contextBridge.exposeInMainWorld('veltriaDesktop', Object.freeze({ sandboxed: process.sandboxed, contextIsolated: process.contextIsolated }))
