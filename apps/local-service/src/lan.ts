import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { hostname, networkInterfaces, release } from 'node:os'
import type { Socket } from 'node:net'
import { lanStateSchema, lanPairStatusSchema, type LanDevice, type LanInterface, type LanPairStatus, type LanState } from '@veltria/contracts'
import { CreationError } from './creation'

const PAIR_TTL_MS = 10 * 60_000
const REQUEST_TTL_MS = 5 * 60_000

function equalText(a: string, b: string): boolean {
  return Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(part => Number(part))
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
  if (parts[0] === 10) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  return false
}

export function detectLanInterfaces(allowLoopback = false): LanInterface[] {
  const wsl = release().toLowerCase().includes('microsoft')
  const list: LanInterface[] = []
  const seen = new Set<string>()
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      const family = String(entry.family)
      if (family !== 'IPv4' && family !== '4') continue
      if (entry.internal && !(allowLoopback && entry.address === '127.0.0.1')) continue
      if (!isPrivateIpv4(entry.address) && !(allowLoopback && entry.address === '127.0.0.1')) continue
      if (seen.has(entry.address)) continue
      seen.add(entry.address)
      list.push({ name, address: entry.address, wsl })
    }
  }
  return list
}

type PendingEntry = {
  id: string
  label: string
  address: string
  requestedAt: string
  expiresAt: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  sessionToken?: string
  csrf?: string
}

export type LanOptions = {
  hostName?: string
  allowLoopbackInterface?: boolean
  interfaces?: () => LanInterface[]
  handler: (req: IncomingMessage, res: ServerResponse) => void
  issueSession: (device: LanDevice) => { token: string; csrf: string }
  revokeDeviceSessions: (deviceId?: string) => void
  changed: () => void
}

export class LanController {
  private readonly hostName: string
  private readonly options: LanOptions
  private readonly lanRequests = new WeakSet<IncomingMessage>()
  private readonly sockets = new Set<Socket>()
  private readonly pending = new Map<string, PendingEntry>()
  private readonly devices = new Map<string, LanDevice>()
  private server: Server | null = null
  private selectedAddress: string | null = null
  private boundOrigin: string | null = null
  private pairingCode: string | null = null
  private pairingToken: string | null = null
  private pairingExpiresAt: number | null = null
  private failedAttempts: number[] = []

  constructor(options: LanOptions) {
    this.options = options
    this.hostName = options.hostName || hostname() || 'Kobocraft PC'
  }

  isLanRequest(req: IncomingMessage): boolean {
    return this.lanRequests.has(req)
  }

  origin(): string | null {
    return this.boundOrigin
  }

  host(): string {
    return this.hostName
  }

  private prune() {
    const now = Date.now()
    if (this.pairingExpiresAt && this.pairingExpiresAt <= now) {
      this.pairingCode = null
      this.pairingToken = null
      this.pairingExpiresAt = null
    }
    for (const [id, entry] of this.pending) {
      if (entry.status === 'pending' && entry.expiresAt <= now) {
        entry.status = 'expired'
      }
      if (entry.expiresAt + 60_000 <= now) {
        this.pending.delete(id)
      }
    }
    this.failedAttempts = this.failedAttempts.filter(timestamp => now - timestamp < 60_000)
  }

  private generatePairingMaterial() {
    this.pairingCode = String(randomInt(100_000, 1_000_000))
    this.pairingToken = randomBytes(32).toString('hex')
    this.pairingExpiresAt = Date.now() + PAIR_TTL_MS
  }

  interfaces(): LanInterface[] {
    return this.options.interfaces ? this.options.interfaces() : detectLanInterfaces(this.options.allowLoopbackInterface)
  }

  state(): LanState {
    this.prune()
    const interfaces = this.interfaces()
    const wslWarning = interfaces.length > 0 && interfaces.every(item => item.wsl)
      ? 'Estás ejecutando el servicio dentro de WSL2. Para conectar desde otro dispositivo físico sin reenvío de puertos, inicia Kobocraft directamente en Windows.'
      : interfaces.length === 0
        ? 'No se detectó ninguna interfaz de red privada (Wi-Fi o Ethernet) activa en este equipo.'
        : null
    return lanStateSchema.parse({
      enabled: Boolean(this.server && this.boundOrigin),
      hostName: this.hostName,
      selectedAddress: this.selectedAddress,
      origin: this.boundOrigin,
      pairingCode: this.pairingCode,
      pairingUrl: this.boundOrigin && this.pairingToken ? `${this.boundOrigin}/#pair=${this.pairingToken}` : null,
      pairingExpiresAt: this.pairingExpiresAt ? new Date(this.pairingExpiresAt).toISOString() : null,
      interfaces,
      pendingRequests: [...this.pending.values()]
        .filter(item => item.status === 'pending')
        .map(({ id, label, address, requestedAt }) => ({ id, label, address, requestedAt })),
      devices: [...this.devices.values()],
      warning: wslWarning
    })
  }

  async enable(address: string, port = 0): Promise<LanState> {
    const available = this.interfaces()
    const match = available.find(item => item.address === address)
    if (!match) {
      throw new CreationError('Selecciona una interfaz de red local privada válida de este equipo.', 400)
    }
    await this.stopServer()
    const server = createServer((req, res) => {
      this.lanRequests.add(req)
      this.options.handler(req, res)
    })
    server.on('connection', socket => {
      this.sockets.add(socket)
      socket.on('close', () => this.sockets.delete(socket))
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen({ host: address, port, exclusive: true }, () => {
        server.removeListener('error', reject)
        resolve()
      })
    }).catch(cause => {
      throw new CreationError(
        cause instanceof Error ? `No se pudo abrir la red local en ${address}: ${cause.message}` : 'No se pudo abrir la red local.',
        409
      )
    })
    const bound = server.address()
    if (!bound || typeof bound === 'string') {
      server.close()
      throw new CreationError('No se pudo determinar el puerto de red local.', 500)
    }
    this.server = server
    this.selectedAddress = address
    this.boundOrigin = `http://${address}:${bound.port}`
    this.generatePairingMaterial()
    this.options.changed()
    return this.state()
  }

  refreshCode(): LanState {
    if (!this.server || !this.boundOrigin) {
      throw new CreationError('Activa primero el uso en red local para generar un código.', 409)
    }
    this.generatePairingMaterial()
    this.options.changed()
    return this.state()
  }

  requestPair(rawCode: string, rawLabel: string | undefined, remoteAddress: string): LanPairStatus {
    this.prune()
    if (!this.server || !this.boundOrigin) {
      throw new CreationError('El acceso en red local no está activo en este momento.', 403)
    }
    if (this.failedAttempts.length >= 10) {
      throw new CreationError('Demasiados intentos fallidos. Genera un código nuevo en el equipo principal.', 429)
    }
    if (!this.pairingCode || !this.pairingToken) {
      throw new CreationError('El código de vinculación ha vencido. Renueva el código en el equipo principal.', 401)
    }
    const cleaned = rawCode.replace(/[\s-]+/g, '')
    const matchesCode = equalText(cleaned, this.pairingCode)
    const matchesToken = equalText(cleaned, this.pairingToken)
    if (!matchesCode && !matchesToken) {
      this.failedAttempts.push(Date.now())
      throw new CreationError('Código de vinculación incorrecto. Compruébalo en el equipo principal.', 401)
    }
    const pendingCount = [...this.pending.values()].filter(item => item.status === 'pending').length
    if (pendingCount >= 12) {
      throw new CreationError('Hay demasiadas solicitudes pendientes de aprobar en el equipo principal.', 429)
    }
    const id = crypto.randomUUID()
    const cleanAddress = remoteAddress.replace(/^::ffff:/, '') || 'Red local'
    const label = (rawLabel?.trim() || 'Dispositivo en red local').slice(0, 60)
    this.pending.set(id, {
      id,
      label,
      address: cleanAddress,
      requestedAt: new Date().toISOString(),
      expiresAt: Date.now() + REQUEST_TTL_MS,
      status: 'pending'
    })
    this.options.changed()
    return lanPairStatusSchema.parse({
      requestId: id,
      status: 'pending',
      hostName: this.hostName
    })
  }

  claimPair(requestId: string): { response: LanPairStatus; sessionToken?: string } {
    this.prune()
    const entry = this.pending.get(requestId)
    if (!entry) {
      return {
        response: lanPairStatusSchema.parse({
          requestId,
          status: 'expired',
          hostName: this.hostName
        })
      }
    }
    if (entry.status === 'approved' && entry.sessionToken && entry.csrf) {
      const token = entry.sessionToken
      const csrf = entry.csrf
      this.pending.delete(requestId)
      return {
        sessionToken: token,
        response: lanPairStatusSchema.parse({
          requestId,
          status: 'approved',
          hostName: this.hostName,
          csrf
        })
      }
    }
    return {
      response: lanPairStatusSchema.parse({
        requestId,
        status: entry.status,
        hostName: this.hostName
      })
    }
  }

  decide(requestId: string, approve: boolean): LanState {
    this.prune()
    const entry = this.pending.get(requestId)
    if (!entry || entry.status !== 'pending') {
      throw new CreationError('La solicitud de vinculación ya no está disponible o ha vencido.', 404)
    }
    if (!approve) {
      entry.status = 'rejected'
      this.options.changed()
      return this.state()
    }
    const now = new Date().toISOString()
    const device: LanDevice = {
      id: crypto.randomUUID(),
      label: entry.label,
      address: entry.address,
      connectedAt: now,
      lastSeenAt: now
    }
    this.devices.set(device.id, device)
    const issued = this.options.issueSession(device)
    entry.status = 'approved'
    entry.sessionToken = issued.token
    entry.csrf = issued.csrf
    this.options.changed()
    return this.state()
  }

  touchDevice(deviceId?: string) {
    if (!deviceId) return
    const device = this.devices.get(deviceId)
    if (device) device.lastSeenAt = new Date().toISOString()
  }

  revokeDevice(deviceId: string): LanState {
    this.devices.delete(deviceId)
    this.options.revokeDeviceSessions(deviceId)
    this.options.changed()
    return this.state()
  }

  private async stopServer() {
    const current = this.server
    this.server = null
    this.selectedAddress = null
    this.boundOrigin = null
    this.pairingCode = null
    this.pairingToken = null
    this.pairingExpiresAt = null
    for (const socket of this.sockets) {
      socket.destroy()
    }
    this.sockets.clear()
    if (current) {
      await new Promise<void>(resolve => current.close(() => resolve()))
    }
  }

  async disable(): Promise<LanState> {
    await this.stopServer()
    this.pending.clear()
    this.devices.clear()
    this.options.revokeDeviceSessions()
    this.options.changed()
    return this.state()
  }

  async close(): Promise<void> {
    await this.stopServer()
    this.pending.clear()
    this.devices.clear()
  }
}
