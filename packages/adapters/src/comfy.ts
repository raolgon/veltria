import { engineUrlSchema, type Engine } from '@veltria/contracts'
export function initialEngine(url: string | null): Engine {
  return { status: url ? 'unchecked' : 'unconfigured', url, checkedAt: null, message: url ? 'Conexión guardada, todavía sin comprobar en esta sesión.' : 'No hay un motor configurado.', version: null, nodeCount: 0, models: [], devices: [] }
}
async function limitedJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, redirect: 'error', headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Respuesta vacía')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 8 * 1024 * 1024) throw new Error('Respuesta superior al límite de 8 MiB')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
export async function probeComfy(value: string, signal?: AbortSignal): Promise<Engine> {
  const url = engineUrlSchema.parse(value), base = initialEngine(url)
  const timeout = AbortSignal.timeout(5000)
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout
  try {
    const [stats, nodes] = await Promise.all([limitedJson(`${url}/system_stats`, abort), limitedJson(`${url}/object_info`, abort)])
    if (!stats || typeof stats !== 'object' || !('system' in stats) || !Array.isArray((stats as any).devices) ||
        !nodes || typeof nodes !== 'object' || Array.isArray(nodes) || !('CheckpointLoaderSimple' in nodes || 'UNETLoader' in nodes)) {
      throw new Error('La respuesta no corresponde a las capacidades esperadas de ComfyUI')
    }
    const models = new Set<string>()
    for (const [node, field] of [['CheckpointLoaderSimple', 'ckpt_name'], ['UNETLoader', 'unet_name'], ['LoraLoader', 'lora_name']] as const) {
      const names = (nodes as any)[node]?.input?.required?.[field]?.[0]
      if (Array.isArray(names)) for (const name of names) if (typeof name === 'string') models.add(`${node}: ${name.slice(0, 500)}`)
    }
    const system = (stats as any).system
    return { ...base, status: 'ready', checkedAt: new Date().toISOString(), message: 'ComfyUI respondió. Esto comprueba su API, no una generación ni la compatibilidad de sus modelos.', version: typeof system?.comfyui_version === 'string' ? system.comfyui_version : null, nodeCount: Object.keys(nodes).length, models: [...models].slice(0, 500), devices: (stats as any).devices.filter((d: any) => typeof d?.name === 'string').map((d: any) => d.name).slice(0, 32) }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Respuesta no válida'
    return { ...base, status: /HTTP|JSON|capacidades|límite/.test(detail) ? 'error' : 'unavailable', checkedAt: new Date().toISOString(), message: `No se pudo comprobar ComfyUI (${detail.slice(0, 160)}). Revisa que esté abierto y vuelve a comprobar; su instalación no se ha modificado.` }
  }
}
