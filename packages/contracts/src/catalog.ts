import { z } from 'zod'
import { imageFormatSchema, imageProfileSchema, recommendationSchema } from './creation'

// Portable data, never executable ComfyUI graphs, scripts or remote dependency URLs.
export const imageConfigurationSchema = z.object({
  kind: z.literal('veltria-image-configuration'), version: z.literal(1),
  name: z.string().trim().min(1).max(80), description: z.string().trim().max(280),
  modelId: z.string().regex(/^[a-z0-9-]{1,80}$/), recipe: z.literal('sd15-text-to-image-v1'),
  parameters: z.object({ steps: z.number().int().min(8).max(40), cfg: z.number().min(1).max(12), sampler: z.literal('euler'), scheduler: z.literal('normal'), format: imageFormatSchema }).strict()
}).strict()
export type ImageConfiguration = z.infer<typeof imageConfigurationSchema>
export const configurationEntrySchema = z.object({ id: z.string(), configuration: imageConfigurationSchema, origin: z.enum(['included', 'imported']) })
export type ConfigurationEntry = z.infer<typeof configurationEntrySchema>
export const catalogSchema = z.object({
  selectedModelId: z.string(), selectedConfigurationId: z.string(), busy: z.boolean(),
  models: z.array(z.object({ profile: imageProfileSchema, status: z.enum(['missing', 'partial', 'downloaded', 'prepared']), received: z.number(), recommendation: recommendationSchema })),
  configurations: z.array(configurationEntrySchema)
})
export type Catalog = z.infer<typeof catalogSchema>
export const catalogSelectionSchema = z.object({ configurationId: z.string().min(1).max(100) }).strict()
