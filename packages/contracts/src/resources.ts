import { z } from 'zod'

const percent = z.number().min(0).max(100).nullable()
const memory = z.object({ total: z.number().nonnegative().nullable(), used: z.number().nonnegative().nullable(), available: z.number().nonnegative().nullable() })
export const resourcesSchema = z.object({
  sampledAt: z.string().datetime(), platform: z.string(), wsl: z.boolean(),
  cpu: z.object({ percent }), ram: memory,
  gpus: z.array(z.object({ name: z.string(), percent, memory })),
  disk: memory.extend({ path: z.string() })
})
export type Resources = z.infer<typeof resourcesSchema>
