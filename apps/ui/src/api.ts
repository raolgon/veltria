import { z } from 'zod'
import { sessionSchema, settingsSchema, hardwareSchema, engineSchema, healthSchema, creationStateSchema, preparationPlanSchema, preparationSchema, jobSchema, librarySchema, resourcesSchema, type Settings, catalogSchema, configurationEntrySchema } from '@veltria/contracts'
import { videoPlanSchema, videoStateSchema, videoJobSchema, videoLibrarySchema } from '@veltria/contracts'
let csrf = ''
async function request<T>(path: string, schema: z.ZodType<T>, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { method, credentials: 'same-origin', headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-veltria-csrf': csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(path === '/hardware' ? 15_000 : path === '/resources' ? 4000 : 12_000) })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.message || `El servicio respondió HTTP ${response.status}. Vuelve a intentarlo.`)
  }
  return schema.parse(await response.json())
}
export const api = {
  async authorize() {
    const params = new URLSearchParams(location.hash.slice(1)), nonce = params.get('launch')
    // Remove one-use material before any other request or navigation.
    if (nonce) history.replaceState(null, '', location.pathname + location.search)
    const session = await request('/session', sessionSchema, nonce ? 'POST' : 'GET', nonce ? { nonce } : undefined)
    csrf = session.csrf; return session.settings
  },
  settings: () => request('/settings', settingsSchema),
  save: (patch: Partial<Settings>) => request('/settings', settingsSchema, 'PATCH', patch),
  hardware: () => request('/hardware', hardwareSchema),
  resources: () => request('/resources', resourcesSchema),
  health: () => request('/health', healthSchema),
  engine: () => request('/engine', engineSchema),
  check: () => request('/engine/check', engineSchema, 'POST', {}),
  catalog: () => request('/catalog', catalogSchema),
  selectConfiguration: (configurationId: string) => request('/catalog/select', creationStateSchema, 'POST', { configurationId }),
  importConfiguration: (configuration: unknown) => request('/catalog/configurations', configurationEntrySchema, 'POST', configuration),
  creation: () => request('/creation', creationStateSchema),
  plan: () => request('/creation/plan', preparationPlanSchema),
  prepare: (revision: string) => request('/creation/prepare', preparationSchema, 'POST', { revision, acceptLicense: true }),
  pause: () => request('/creation/pause', preparationSchema, 'POST', {}),
  create: (input: { requestId: string; prompt: string; format: 'square' | 'landscape' | 'portrait' }) => request('/jobs', jobSchema, 'POST', input),
  jobs: (offset = 0) => request(`/jobs?offset=${offset}&limit=24`, librarySchema),
  cancel: (id: string) => request(`/jobs/${id}/cancel`, jobSchema, 'POST', {}),
  reconcile: (id: string) => request(`/jobs/${id}/reconcile`, jobSchema, 'POST', {}),
  video: () => request('/video', videoStateSchema),
  videoPlan: () => request('/video/plan', videoPlanSchema),
  prepareVideo: (revision: string) => request('/video/prepare', videoStateSchema.shape.preparation, 'POST', { revision, acceptExperimental: true, acceptLicense: true }),
  pauseVideo: () => request('/video/pause', videoStateSchema.shape.preparation, 'POST', {}),
  createVideo: (input: { requestId: string; prompt: string; preset: 'preview' | 'short' }) => request('/video/jobs', videoJobSchema, 'POST', input),
  videos: (offset = 0) => request(`/video/jobs?offset=${offset}&limit=24`, videoLibrarySchema),
  cancelVideo: (id: string) => request(`/video/jobs/${id}/cancel`, videoJobSchema, 'POST', {}),
  reconcileVideo: (id: string) => request(`/video/jobs/${id}/reconcile`, videoJobSchema, 'POST', {})
}
