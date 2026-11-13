import { z } from 'zod'

export const lanInterfaceSchema = z.object({
  name: z.string(),
  address: z.string(),
  wsl: z.boolean().default(false)
})
export type LanInterface = z.infer<typeof lanInterfaceSchema>

export const lanPendingRequestSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(80),
  address: z.string(),
  requestedAt: z.string()
})
export type LanPendingRequest = z.infer<typeof lanPendingRequestSchema>

export const lanDeviceSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(80),
  address: z.string(),
  connectedAt: z.string(),
  lastSeenAt: z.string()
})
export type LanDevice = z.infer<typeof lanDeviceSchema>

export const lanStateSchema = z.object({
  enabled: z.boolean(),
  hostName: z.string(),
  selectedAddress: z.string().nullable(),
  origin: z.string().nullable(),
  pairingCode: z.string().nullable(),
  pairingUrl: z.string().nullable(),
  pairingExpiresAt: z.string().nullable(),
  interfaces: z.array(lanInterfaceSchema),
  pendingRequests: z.array(lanPendingRequestSchema),
  devices: z.array(lanDeviceSchema),
  warning: z.string().nullable().default(null)
})
export type LanState = z.infer<typeof lanStateSchema>

export const lanEnableRequestSchema = z.object({
  address: z.string().min(7).max(45),
  port: z.number().int().min(0).max(65535).optional()
}).strict()

export const lanPairRequestSchema = z.object({
  code: z.string().trim().min(6).max(64),
  label: z.string().trim().min(1).max(60).optional()
}).strict()

export const lanPairStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  hostName: z.string(),
  csrf: z.string().optional()
})
export type LanPairStatus = z.infer<typeof lanPairStatusSchema>

export const lanDecisionRequestSchema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean()
}).strict()
