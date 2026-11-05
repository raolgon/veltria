import { z } from 'zod'
import { preparationPlanSchema, imageProfileSchema, recommendationSchema, creationStateSchema } from './creation'
export const installationSchema = z.object({
  id: z.string().length(64), name: z.string(), kind: z.enum(['linked', 'pinokio', 'portable', 'desktop', 'folder']),
  directory: z.string(), python: z.string().nullable(), available: z.boolean(), reason: z.string()
})
export type Installation = z.infer<typeof installationSchema>
export const setupStateSchema = z.object({
  scanId: z.string().uuid().nullable(), status: z.enum(['idle', 'scanning', 'complete', 'error']),
  installations: z.array(installationSchema), notes: z.array(z.string()), message: z.string(), checkedAt: z.string().nullable()
})
export type SetupState = z.infer<typeof setupStateSchema>
export const setupScanSchema = z.object({ directory: z.string().trim().min(1).max(1000).optional() }).strict()
export const setupPlanRequestSchema = z.object({ scanId: z.string().uuid(), installationId: z.string().length(64) }).strict()
export const setupPlanSchema = z.object({
  revision: z.string().length(64), scanId: z.string().uuid(), installation: installationSchema,
  profile: imageProfileSchema, configurationId: z.string(), configuration: creationStateSchema.shape.configuration, recommendation: recommendationSchema,
  preparation: preparationPlanSchema
})
export type SetupPlan = z.infer<typeof setupPlanSchema>
export const setupPrepareSchema = z.object({ revision: z.string().length(64), acceptLicense: z.literal(true), acceptReuse: z.literal(true) }).strict()
