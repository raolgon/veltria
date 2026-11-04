import { z } from 'zod'

export const videoPresetSchema = z.enum(['preview', 'short'])
export const videoComponentSchema = z.object({ role: z.string(), filename: z.string(), path: z.string(), bytes: z.number().nonnegative().nullable(), modified: z.number().nullable(), status: z.enum(['present', 'missing', 'invalid']) })
export type VideoComponent = z.infer<typeof videoComponentSchema>
export const videoPlanSchema = z.object({
  revision: z.string(), model: z.literal('MiniMax H3'), components: z.array(videoComponentSchema), blockers: z.array(z.string()), warnings: z.array(z.string()),
  downloadBytes: z.literal(0), requiredBytes: z.number(), availableBytes: z.number().nullable(), canPrepare: z.boolean(), experimental: z.literal(true),
  ramTotal: z.number().nullable(), ramAvailable: z.number().nullable(), vramTotal: z.number().nullable(), source: z.string().url(), licenseUrl: z.string().url()
})
export type VideoPlan = z.infer<typeof videoPlanSchema>
export const videoMetadataSchema = z.object({ width: z.number().int().positive(), height: z.number().int().positive(), duration: z.number().positive(), fps: z.number().positive(), frames: z.number().int().nonnegative(), codec: z.literal('h264'), audio: z.boolean() })
export type VideoMetadata = z.infer<typeof videoMetadataSchema>
export const videoJobSchema = z.object({
  id: z.string().uuid(), requestId: z.string().uuid(), prompt: z.string(), preset: videoPresetSchema, status: z.enum(['queued', 'submitting', 'running', 'saving', 'completed', 'cancelled', 'failed', 'interrupted']),
  width: z.number(), height: z.number(), frames: z.number(), fps: z.number(), seed: z.number(), steps: z.number(), step: z.number().nullable(), message: z.string(),
  createdAt: z.string(), updatedAt: z.string(), enginePromptId: z.string().nullable(), engineUrl: z.string().nullable(), engineVersion: z.string().nullable(), revision: z.string(), artifactId: z.string().uuid().nullable(), sha256: z.string().nullable(), metadata: videoMetadataSchema.nullable()
})
export type VideoJob = z.infer<typeof videoJobSchema>
export const videoLibrarySchema = z.object({ jobs: z.array(videoJobSchema), total: z.number() })
export const videoStateSchema = z.object({
  preparation: z.object({ status: z.enum(['idle', 'checking', 'ready', 'error']), revision: z.string(), message: z.string() }),
  activeJob: videoJobSchema.nullable(), canCreate: z.boolean(), experimental: z.literal(true), verifiedPresets: z.array(videoPresetSchema)
})
export type VideoState = z.infer<typeof videoStateSchema>
export const prepareVideoSchema = z.object({ revision: z.string().length(64), acceptExperimental: z.literal(true), acceptLicense: z.literal(true) }).strict()
export const createVideoSchema = z.object({ requestId: z.string().uuid(), prompt: z.string().trim().min(1).max(4000), preset: videoPresetSchema.default('preview') }).strict()
