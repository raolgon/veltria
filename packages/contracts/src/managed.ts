import { z } from 'zod'
import { preparationPlanSchema } from './creation'
import { storageIssueSchema } from './storage-issue'
export const managedStateSchema = z.object({
  status: z.enum(['idle', 'downloading', 'installing', 'preparing', 'paused', 'error', 'ready']),
  message: z.string(), received: z.number().nonnegative(), total: z.number().nonnegative(),
  revision: z.string(), updatedAt: z.string(),
  storageIssue: storageIssueSchema.nullable().optional(),
})
export type ManagedState = z.infer<typeof managedStateSchema>
export const managedPlanSchema = z.object({
  revision: z.string().length(64), recipe: z.string(), directory: z.string(), model: z.string(), configuration: z.string(),
  remainingBytes: z.number().nonnegative(), totalBytes: z.number().nonnegative(), requiredBytes: z.number().nonnegative(),
  availableBytes: z.number().nullable(), canPrepare: z.boolean(), blockers: z.array(z.string()),
  sources: z.array(z.string()), licenses: z.array(z.string()), preparation: preparationPlanSchema,
  separateInstallation: z.boolean().default(false),
  storageIssues: z.array(storageIssueSchema).optional(),
})
export type ManagedPlan = z.infer<typeof managedPlanSchema>
export const managedPrepareSchema = z.object({ revision: z.string().length(64), acceptInstallation: z.literal(true), acceptLicense: z.literal(true) }).strict()
