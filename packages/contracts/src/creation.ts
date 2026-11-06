import { z } from 'zod'
export const bindingSchema = z.object({ directory: z.string().min(1).max(1000), python: z.string().min(1).max(1000) }).strict()
export const imageFormatSchema = z.enum(['square', 'landscape', 'portrait'])
export const preparationSchema = z.object({
  id: z.string(), profileId: z.string(), revision: z.string(),
  status: z.enum(['idle', 'downloading', 'paused', 'verifying', 'starting', 'ready', 'error']),
  received: z.number().nonnegative(), total: z.number().nonnegative(), message: z.string(),
  updatedAt: z.string(), checkpoint: z.string().nullable(), verifiedHash: z.string().nullable()
})
export type Preparation = z.infer<typeof preparationSchema>
export const imageQualitySchema = z.object({ width: z.number().int().min(256).max(1536).multipleOf(64), height: z.number().int().min(256).max(1536).multipleOf(64), steps: z.number().int().min(1).max(60), cfg: z.number().min(1).max(15) }).strict()
export type ImageQuality = z.infer<typeof imageQualitySchema>
export const jobSchema = z.object({
  id: z.string().uuid(), requestId: z.string().uuid(), profileId: z.string(),
  status: z.enum(['queued', 'submitting', 'running', 'saving', 'completed', 'cancelled', 'failed', 'interrupted']),
  prompt: z.string(), format: imageFormatSchema, seed: z.number(), width: z.number(), height: z.number(),
  configurationId: z.string().optional(), configurationName: z.string().optional(), configurationOrigin: z.enum(['included', 'imported']).optional(), configurationRevision: z.string().optional(), cfg: z.number().optional(), sampler: z.literal('euler').optional(), scheduler: z.literal('normal').optional(),
  requestedQuality: imageQualitySchema.optional(), steps: z.number(), step: z.number().nullable(), enginePromptId: z.string().nullable(), engineUrl: z.string().nullable(),
  createdAt: z.string(), updatedAt: z.string(), message: z.string(), imageId: z.string().uuid().nullable(),
  engineVersion: z.string().nullable(), profileRevision: z.string()
})
export type ImageJob = z.infer<typeof jobSchema>
export const createImageSchema = z.object({ requestId: z.string().uuid(), prompt: z.string().trim().min(1).max(4000), format: imageFormatSchema.default('square'), quality: imageQualitySchema.optional() }).strict()
export type CreateImageInput = z.infer<typeof createImageSchema>
export const imageProfileSchema = z.object({
  family: z.enum(['sd15','sdxl']).optional(), id: z.string(), revision: z.string(), title: z.string(), description: z.string(), model: z.string(),
  source: z.string().url(), license: z.string(), licenseUrl: z.string().url(), bytes: z.number(),
  width: z.number(), height: z.number(), steps: z.number(), limitations: z.array(z.string()), adaptation: z.object({ base: z.string(), strength: z.number().min(0).max(1.5) }).optional()
})
export const recommendationSchema = z.object({ level: z.enum(['recommended', 'limited', 'unknown', 'unsupported']), reason: z.string(), verified: z.boolean(), evidence: z.string().nullable(), evidenceDetails: z.object({ at: z.string(), width: z.number(), height: z.number() }).nullable().optional() })
export const preparationPlanSchema = z.object({
  revision: z.string(), profileId: z.string(), destination: z.string(), totalBytes: z.number(),
  remainingBytes: z.number(), requiredBytes: z.number(), availableBytes: z.number().nullable(),
  canPrepare: z.boolean(), blockers: z.array(z.string()), changes: z.array(z.string()),
  license: z.string(), licenseUrl: z.string(), source: z.string(), reuseBytes: z.number()
})
export type PreparationPlan = z.infer<typeof preparationPlanSchema>
export const creationStateSchema = z.object({
  configuration: z.object({ id: z.string(), name: z.string(), origin: z.enum(['included', 'imported']), steps: z.number(), cfg: z.number(), format: imageFormatSchema }),
  profile: imageProfileSchema, recommendation: recommendationSchema, preparation: preparationSchema,
  activeJob: jobSchema.nullable(), bound: z.boolean(), engineRunning: z.boolean(), canCreate: z.boolean()
})
export type CreationState = z.infer<typeof creationStateSchema>
export const prepareRequestSchema = z.object({ revision: z.string().length(64), acceptLicense: z.literal(true) }).strict()
export const librarySchema = z.object({ jobs: z.array(jobSchema), total: z.number(), offset: z.number(), limit: z.number() })
