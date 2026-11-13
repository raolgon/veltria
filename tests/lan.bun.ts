import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, secret } from '../apps/local-service/src/server'
import { isPrivateIpv4 } from '../apps/local-service/src/lan'
import { qrSvgPath } from '@veltria/core'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

// 1. Verify QR encoder and private IPv4 checks
assert(isPrivateIpv4('192.168.1.45') === true, '192.168.1.45 debe ser IPv4 privada')
assert(isPrivateIpv4('10.0.0.8') === true, '10.0.0.8 debe ser IPv4 privada')
assert(isPrivateIpv4('172.20.5.1') === true, '172.20.5.1 debe ser IPv4 privada')
assert(isPrivateIpv4('172.32.0.1') === false, '172.32.0.1 no debe ser IPv4 privada')
assert(isPrivateIpv4('8.8.8.8') === false, '8.8.8.8 no debe ser IPv4 privada')

const qr = qrSvgPath('http://192.168.1.45:51234/#pair=' + 'a'.repeat(64))
assert(qr.size > 20 && qr.path.startsWith('M'), 'El generador QR debe producir un path SVG válido')

// 2. Spin up server with loopback allowed as test LAN interface
const root = await mkdtemp(join(tmpdir(), 'kobocraft-lan-test-'))
const dataDir = join(root, 'data')
const uiDir = join(root, 'ui')
await mkdir(dataDir, { recursive: true })
await mkdir(uiDir, { recursive: true })
await writeFile(join(uiDir, 'index.html'), '<!doctype html><title>Kobocraft</title>')

const controlToken = secret()
const server = await createServer({
  dataDir,
  uiDir,
  controlToken,
  instanceId: crypto.randomUUID(),
  lan: {
    hostName: 'Kobocraft-Host-PC',
    allowLoopbackInterface: true
  }
})

try {
  const ownerOrigin = await server.listen(0)
  const nonce = server.issueNonce()
  const ownerSessionRes = await fetch(`${ownerOrigin}/api/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ownerOrigin },
    body: JSON.stringify({ nonce })
  })
  assert(ownerSessionRes.status === 200, 'El propietario local debe poder abrir sesión con nonce')
  const ownerCookie = ownerSessionRes.headers.get('set-cookie')?.split(';')[0] ?? ''
  const ownerSession = await ownerSessionRes.json() as { csrf: string; role: string }
  assert(ownerSession.role === 'owner', 'El rol de la sesión local debe ser owner')

  // Initial LAN state is disabled
  const initialLanRes = await fetch(`${ownerOrigin}/api/v1/lan`, {
    headers: { cookie: ownerCookie }
  })
  const initialLan = await initialLanRes.json() as { enabled: boolean; interfaces: Array<{ address: string }> }
  assert(initialLan.enabled === false, 'La red local debe iniciar desactivada por defecto')
  assert(initialLan.interfaces.some(i => i.address === '127.0.0.1'), 'Debe listar la interfaz de prueba')

  // Enable LAN on 127.0.0.1 (secondary port)
  const enableRes = await fetch(`${ownerOrigin}/api/v1/lan/enable`, {
    method: 'POST',
    headers: {
      cookie: ownerCookie,
      origin: ownerOrigin,
      'content-type': 'application/json',
      'x-veltria-csrf': ownerSession.csrf
    },
    body: JSON.stringify({ address: '127.0.0.1' })
  })
  assert(enableRes.status === 200, 'El propietario debe poder activar la red local')
  const enabledLan = await enableRes.json() as { enabled: boolean; origin: string; pairingCode: string; pairingUrl: string }
  assert(enabledLan.enabled === true && Boolean(enabledLan.origin), 'Debe devolver el origen LAN activo')
  assert(enabledLan.origin !== ownerOrigin, 'El listener LAN debe ser independiente del listener loopback principal')
  assert(/^\d{6}$/.test(enabledLan.pairingCode), 'Debe generar un código de 6 dígitos')

  const lanOrigin = enabledLan.origin

  // Unauthenticated LAN request to static UI works, but /api/v1/session returns 401 LAN_SESSION
  const uiRes = await fetch(`${lanOrigin}/`)
  assert(uiRes.status === 200, 'El listener LAN debe servir la interfaz web para vincular')

  const unauthLanSession = await fetch(`${lanOrigin}/api/v1/session`)
  assert(unauthLanSession.status === 401, 'El listener LAN debe exigir vinculación antes de dar sesión')
  const unauthBody = await unauthLanSession.json() as { error: string }
  assert(unauthBody.error === 'LAN_SESSION', 'El error de sesión LAN ausente debe ser LAN_SESSION')

  // Loopback nonce exchange must be blocked on LAN listener
  const nonceOnLan = await fetch(`${lanOrigin}/api/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: lanOrigin },
    body: JSON.stringify({ nonce: server.issueNonce() })
  })
  assert(nonceOnLan.status === 403, 'El intercambio de nonce local debe rechazarse en el listener LAN')

  // Wrong pairing code must fail with 401
  const badPair = await fetch(`${lanOrigin}/api/v1/lan/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: lanOrigin },
    body: JSON.stringify({ code: '000000', label: 'Teléfono de prueba' })
  })
  assert(badPair.status === 401, 'Un código incorrecto debe rechazarse con 401')

  // Valid pairing code creates a pending request
  const pairRes = await fetch(`${lanOrigin}/api/v1/lan/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: lanOrigin },
    body: JSON.stringify({ code: enabledLan.pairingCode, label: 'Mi iPhone' })
  })
  assert(pairRes.status === 200, 'Un código válido debe registrar la solicitud pendiente')
  const pairStatus = await pairRes.json() as { requestId: string; status: string; hostName: string }
  assert(pairStatus.status === 'pending' && pairStatus.hostName === 'Kobocraft-Host-PC', 'La solicitud debe quedar en estado pending')

  // Owner approves the request in 1 click
  const decisionRes = await fetch(`${ownerOrigin}/api/v1/lan/decision`, {
    method: 'POST',
    headers: {
      cookie: ownerCookie,
      origin: ownerOrigin,
      'content-type': 'application/json',
      'x-veltria-csrf': ownerSession.csrf
    },
    body: JSON.stringify({ requestId: pairStatus.requestId, approve: true })
  })
  assert(decisionRes.status === 200, 'El propietario debe poder aprobar la solicitud')

  // LAN client polls and receives session cookie + CSRF
  const claimRes = await fetch(`${lanOrigin}/api/v1/lan/pair/${pairStatus.requestId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: lanOrigin },
    body: JSON.stringify({})
  })
  assert(claimRes.status === 200, 'El dispositivo LAN debe poder reclamar la aprobación')
  const lanCookie = claimRes.headers.get('set-cookie')?.split(';')[0] ?? ''
  const claimBody = await claimRes.json() as { status: string; csrf?: string }
  assert(claimBody.status === 'approved' && Boolean(claimBody.csrf) && Boolean(lanCookie), 'Debe entregar cookie de sesión y token CSRF al aprobar')

  // LAN client can read session, creation, and jobs
  const lanSessionRes = await fetch(`${lanOrigin}/api/v1/session`, {
    headers: { cookie: lanCookie }
  })
  assert(lanSessionRes.status === 200, 'El dispositivo LAN aprobado debe poder consultar su sesión')
  const lanSessionData = await lanSessionRes.json() as { role: string; deviceLabel: string }
  assert(lanSessionData.role === 'lan' && lanSessionData.deviceLabel === 'Mi iPhone', 'La sesión LAN debe tener rol lan y etiqueta del dispositivo')

  const lanJobsRes = await fetch(`${lanOrigin}/api/v1/jobs`, {
    headers: { cookie: lanCookie }
  })
  assert(lanJobsRes.status === 200, 'El dispositivo LAN debe poder consultar la biblioteca')

  // LAN client is forbidden from modifying host settings or LAN state
  const forbiddenPatch = await fetch(`${lanOrigin}/api/v1/settings`, {
    method: 'PATCH',
    headers: {
      cookie: lanCookie,
      origin: lanOrigin,
      'content-type': 'application/json',
      'x-veltria-csrf': claimBody.csrf!
    },
    body: JSON.stringify({ theme: 'light' })
  })
  assert(forbiddenPatch.status === 403, 'El dispositivo LAN no debe poder modificar los ajustes del host')

  // Owner revokes the LAN device
  const afterApproveLan = await decisionRes.json() as { devices: Array<{ id: string }> }
  const deviceId = afterApproveLan.devices[0]?.id
  assert(Boolean(deviceId), 'El dispositivo aprobado debe figurar en la lista de conectados')

  const revokeRes = await fetch(`${ownerOrigin}/api/v1/lan/revoke`, {
    method: 'POST',
    headers: {
      cookie: ownerCookie,
      origin: ownerOrigin,
      'content-type': 'application/json',
      'x-veltria-csrf': ownerSession.csrf
    },
    body: JSON.stringify({ deviceId })
  })
  assert(revokeRes.status === 200, 'El propietario debe poder desconectar un dispositivo LAN')

  const afterRevokeRes = await fetch(`${lanOrigin}/api/v1/session`, {
    headers: { cookie: lanCookie }
  })
  assert(afterRevokeRes.status === 401, 'La sesión LAN revocada debe quedar invalidada inmediatamente')
} finally {
  await server.close()
  await rm(root, { recursive: true, force: true })
}
console.log('LAN smoke & security test passed.')
