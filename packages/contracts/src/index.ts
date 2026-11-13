import { z } from 'zod'
import { bindingSchema } from './creation'
export * from './creation'
export * from './resources'
export * from './video'
export * from './catalog'
export * from './setup'
export * from './managed'
export * from './storage-issue'
export * from './lan'
export const protocol = 9 as const
export const development = { uiOrigin: 'http://127.0.0.1:43120', serviceOrigin: 'http://127.0.0.1:43121' } as const
export const themeSchema = z.enum(['system', 'light', 'dark'])
export const localeSchema = z.enum(['es', 'en'])
export type Locale = z.infer<typeof localeSchema>
export const engineUrlSchema = z.string().max(200).transform((value, ctx) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error()
    // Pin localhost to literal loopback; no DNS lookups or network scanning.
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
    return url.origin
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Usa http://127.0.0.1:puerto, localhost o [::1], sin rutas ni credenciales.' })
    return z.NEVER
  }
})
export const settingsSchema = z.object({ theme: themeSchema, locale: localeSchema.default('es'), engineUrl: engineUrlSchema.nullable(), engineBinding: bindingSchema.nullable().default(null), modelsDirectory: z.string().min(1).max(1000).nullable().default(null) }).strict()
export const settingsPatchSchema = z.object({ theme: themeSchema.optional(), locale: localeSchema.optional(), engineUrl: engineUrlSchema.nullable().optional(), engineBinding: bindingSchema.nullable().optional(), modelsDirectory: z.string().min(1).max(1000).nullable().optional() }).strict().refine(v => Object.keys(v).length > 0)
export type Settings = z.infer<typeof settingsSchema>
export const sessionSchema = z.object({ csrf: z.string().min(32), settings: settingsSchema, role: z.enum(['owner', 'lan']).default('owner'), hostName: z.string().optional(), deviceLabel: z.string().optional() })
export const healthSchema = z.object({ name: z.literal('veltria'), protocol: z.literal(protocol), instanceId: z.string(), version: z.string(), runtime: z.string(), capabilities: z.object({ hardware: z.literal(true), engineProbe: z.literal(true), generation: z.boolean(), preparation: z.boolean(), video: z.boolean().default(false), lan: z.boolean() }) })
const measurement = z.object({ total: z.number().nonnegative().nullable(), available: z.number().nonnegative().nullable(), source: z.string() })
export const hardwareSchema = z.object({
  sampledAt: z.string(), host: z.string(), platform: z.string(), arch: z.string(), release: z.string(), wsl: z.boolean(),
  cpu: z.object({ name: z.string().nullable(), logicalCores: z.number(), source: z.string() }),
  ram: measurement, disk: measurement.extend({ path: z.string() }),
  gpus: z.array(z.object({ name: z.string(), vramTotal: z.number().nonnegative().nullable(), vramAvailable: z.number().nonnegative().nullable(), driver: z.string().nullable(), source: z.string() })),
  notes: z.array(z.string())
})
export type Hardware = z.infer<typeof hardwareSchema>
export const engineSchema = z.object({
  status: z.enum(['unconfigured', 'unchecked', 'checking', 'ready', 'unavailable', 'error']),
  url: z.string().nullable(), checkedAt: z.string().nullable(), message: z.string(),
  version: z.string().nullable(), nodeCount: z.number(), models: z.array(z.string()), devices: z.array(z.string())
})
export type Engine = z.infer<typeof engineSchema>
export const readySchema = z.object({ name: z.literal('veltria'), protocol: z.literal(protocol), instanceId: z.string(), origin: z.string().url(), nonce: z.string().min(32) }).strict()
export const eventSchema = z.object({ sequence: z.number(), kind: z.enum(['connected', 'settings', 'engine', 'creation', 'jobs', 'video', 'setup', 'lan']), instanceId: z.string() })
export const errorSchema = z.object({ error: z.string(), message: z.string() })

