export {}
declare global {
  interface Window {
    veltriaDesktop?: Readonly<{ sandboxed: true; contextIsolated: true; chooseEngineDirectory: () => Promise<string | null> }>
  }
}
