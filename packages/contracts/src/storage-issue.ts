import { z } from 'zod'
export const storageIssueSchema = z.object({
  code: z.enum(['disk-full','permission-denied','read-only','quota','low-space','space-unknown']),
  severity: z.enum(['warning','error']), target: z.enum(['environment','models','data']),
  path: z.string(), message: z.string(), requiredBytes: z.number().nonnegative().nullable(), availableBytes: z.number().nonnegative().nullable()
})
export type StorageIssue = z.infer<typeof storageIssueSchema>
