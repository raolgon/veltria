import { browseCompatible, browseInput, discover, discoverInput, adoptInput } from './discovery'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import staticFiles from '@fastify/static'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { ServerResponse } from 'node:http'
import { z } from 'zod'
import { protocol, settingsPatchSchema, sessionSchema, healthSchema, engineSchema, createImageSchema, prepareRequestSchema, creationStateSchema, preparationSchema, jobSchema, librarySchema, prepareVideoSchema, createVideoSchema, videoJobSchema, catalogSchema, catalogSelectionSchema, storageSchema, removalPlanSchema, removalRequestSchema, imageConfigurationSchema, setupScanSchema, setupPlanRequestSchema, setupPrepareSchema, setupStateSchema, setupPlanSchema } from '@veltria/contracts'
import { SettingsRepository, detectHardware, probeComfy, initialEngine, ResourceMonitor } from '@veltria/adapters'
import { join, isAbsolute } from 'node:path'
import { createReadStream } from 'node:fs'
import { validateEngineBinding } from '../../../packages/adapters/src/image-engine'
import { CreationController, CreationError } from './creation'
import { VideoController, type VideoOptions } from './video'
import { SetupController, type SetupOptions } from './setup'
import { mkdir, stat, writeFile } from 'node:fs/promises'

export const secret = () => randomBytes(32).toString('hex')
function equal(a: unknown, b: string): boolean {
  return typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
type Options = { dataDir: string; uiDir: string; controlToken: string; instanceId: string; devOrigin?: string; onShutdown?: () => void; creation?: Pick<ConstructorParameters<typeof CreationController>[0], 'profile' | 'profiles' | 'hardware' | 'disk' | 'engine' | 'allowLocalFixture'>; setup?: Pick<SetupOptions, 'discover'>; video?: Pick<VideoOptions, 'hardware' | 'components' | 'probe' | 'engine' | 'disk'> }
export async function createServer(options: Options) {
  const app = Fastify({ logger: false, bodyLimit: 32768, requestTimeout: 10_000, connectionTimeout: 10_000, keepAliveTimeout: 5000 })
  const database = join(options.dataDir, 'settings.sqlite'), existed = await stat(database).then(() => true).catch(() => false)
  const repository = new SettingsRepository(database)
  if (existed && (repository.db.query('PRAGMA user_version').get() as { user_version: number }).user_version < 4) {
    const directory = join(options.dataDir, 'backups'); await mkdir(directory, { recursive: true })
    await writeFile(join(directory, `before-catalog-${Date.now()}-${crypto.randomUUID()}.sqlite`), repository.db.serialize(), { flag: 'wx', mode: 0o600 })
  }
  const resources = new ResourceMonitor(options.dataDir)
  const sessions = new Map<string, { csrf: string; expires: number }>()
  const nonces = new Map<string, number>()
  const streams = new Map<ServerResponse, number>()
  let origin = '', sequence = 0, engine = initialEngine(repository.get().engineUrl), closing = false
  const engineAbort = new AbortController()
  const identity = { name: 'veltria' as const, protocol, instanceId: options.instanceId }
  const issueNonce = () => {
    const now = Date.now()
    for (const [nonce, expires] of nonces) if (expires < now) nonces.delete(nonce)
    if (nonces.size >= 32) throw new Error('Demasiados lanzamientos pendientes; espera un minuto.')
    const nonce = secret(); nonces.set(nonce, now + 60_000); return nonce
  }
  function emit(kind: 'settings' | 'engine' | 'creation' | 'jobs' | 'video' | 'setup') {
    const payload = `id: ${++sequence}\ndata: ${JSON.stringify({ sequence, kind, instanceId: options.instanceId })}\n\n`
    for (const [stream, expires] of streams) {
      if (expires <= Date.now() || stream.writableLength > 64_000) stream.end()
      else stream.write(payload)
    }
  }
  const creation = new CreationController({ ...options.creation, dataDir: options.dataDir, repository, changed: emit })
  const video = new VideoController({ ...options.video, dataDir: options.dataDir, repository, changed: () => emit('video') })
  const setup = new SetupController({ ...options.setup, settings: () => repository.get(), creation, changed: () => emit('setup') })
  // Serialize ownership changes, including requests from separate browser/desktop clients.
  let gpuAction: Promise<unknown> = Promise.resolve()
  function serialized<T>(work: () => Promise<T>): Promise<T> { const run = gpuAction.then(work); gpuAction = run.catch(() => {}); return run }
  function withEngine<T>(kind: 'image' | 'video', work: () => Promise<T>): Promise<T> {
    return serialized(async () => { if (kind === 'image') await video.releaseEngine(); else await creation.releaseEngine(); return work() })
  }
  const error = (reply: FastifyReply, status: number, code: string, message: string) => reply.code(status).send({ error: code, message })
  await app.register(cookie)
  app.addHook('onRequest', async (request, reply) => {
    const allowed = [origin, options.devOrigin].filter(Boolean)
    if (!allowed.some(o => new URL(o!).host === request.headers.host)) return error(reply, 403, 'HOST', 'Host no autorizado.')
    if (request.headers.origin && !allowed.includes(request.headers.origin)) return error(reply, 403, 'ORIGIN', 'Origen no autorizado.')
    if (request.headers['sec-fetch-site'] === 'cross-site') return error(reply, 403, 'ORIGIN', 'Solicitud desde otra web rechazada.')
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer')
      .header('Cross-Origin-Resource-Policy', 'same-origin')
      .header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
    const path = request.url.split('?')[0]
    if (!path.startsWith('/api/')) return
    reply.header('Cache-Control', 'no-store')
    if (path.startsWith('/api/v1/control/')) {
      if (!equal(request.headers['x-veltria-control'], options.controlToken)) return error(reply, 401, 'CONTROL', 'Control no autorizado.')
      return
    }
    if (path === '/api/v1/identity' && request.method === 'GET') return
    if (path === '/api/v1/session' && request.method === 'POST') {
      if (!request.headers.origin || !allowed.includes(request.headers.origin)) return error(reply, 403, 'ORIGIN', 'Se requiere un origen local autorizado.')
      return
    }
    const session = sessions.get(request.cookies.veltria_session ?? '')
    if (!session || session.expires <= Date.now()) return error(reply, 401, 'SESSION', 'Sesión ausente o vencida. Vuelve a abrir Veltria desde el lanzador.')
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (!request.headers.origin || !equal(request.headers['x-veltria-csrf'], session.csrf)) return error(reply, 403, 'CSRF', 'La autorización de esta acción ha vencido. Vuelve a abrir Veltria.')
    }
  })
  app.setErrorHandler((cause, _request, reply) => {
    if (cause instanceof CreationError) return error(reply, cause.statusCode, 'CREATION', cause.message)
    if (cause instanceof z.ZodError || (cause as any).validation || (cause as any).statusCode === 400) return error(reply, 400, 'VALIDATION', 'Entrada no válida. Revisa los valores y vuelve a intentarlo.')
    if ((cause as any).statusCode === 413) return error(reply, 413, 'LIMIT', 'Solicitud demasiado grande.')
    if ((cause as any).statusCode === 415) return error(reply, 415, 'CONTENT_TYPE', 'Usa JSON para esta acción.')
    console.error('Error del servicio:', cause instanceof Error ? cause.name : 'desconocido')
    return error(reply, 500, 'INTERNAL', 'No se pudo completar la acción. Tus ajustes guardados se conservan.')
  })
  app.get('/api/v1/identity', async () => identity)
  app.post('/api/v1/control/launch', async () => ({ ...identity, origin, nonce: issueNonce() }))
  app.post('/api/v1/control/shutdown', async (_req, reply) => {
    reply.send({ stopping: true })
    setTimeout(() => options.onShutdown?.(), 20)
  })
  app.post('/api/v1/session', async (request, reply) => {
    const { nonce } = z.object({ nonce: z.string().length(64) }).strict().parse(request.body)
    const expires = nonces.get(nonce)
    nonces.delete(nonce)
    if (!expires || expires < Date.now()) return error(reply, 401, 'NONCE', 'El enlace de apertura venció o ya se usó. Abre uno nuevo con el lanzador.')
    for (const [key, s] of sessions) if (s.expires < Date.now()) sessions.delete(key)
    if (sessions.size >= 128) return error(reply, 429, 'SESSIONS', 'Demasiadas sesiones locales.')
    const token = secret(), session = { csrf: secret(), expires: Date.now() + 12 * 60 * 60 * 1000 }
    sessions.set(token, session)
    reply.setCookie('veltria_session', token, { path: '/api/v1', httpOnly: true, sameSite: 'strict', secure: false, maxAge: 43200 })
    return sessionSchema.parse({ csrf: session.csrf, settings: repository.get() })
  })
  app.get('/api/v1/session', async (request) => sessionSchema.parse({ csrf: sessions.get(request.cookies.veltria_session!)!.csrf, settings: repository.get() }))
  app.get('/api/v1/health', async () => healthSchema.parse({ ...identity, version: '0.8.0', runtime: `Bun ${Bun.version}`, capabilities: { hardware: true, engineProbe: true, generation: true, preparation: true, video: true, lan: false } }))
  app.get('/api/v1/activity', async () => { const image = creation.activity(), movie = video.activity(); return { preparing: image.preparing || movie.preparing, jobs: image.jobs + movie.jobs } })
  app.get('/api/v1/settings', async () => repository.get())
  app.patch('/api/v1/settings', async request => serialized(async () => {
    const patch = settingsPatchSchema.parse(request.body)
    if ('engineBinding' in patch || 'modelsDirectory' in patch) {
      creation.assertConfigurationMutable()
      video.assertMutable()
      if (patch.modelsDirectory && !isAbsolute(patch.modelsDirectory)) throw new CreationError('Selecciona una ubicación absoluta para los modelos.', 400)
      if (patch.engineBinding) {
        try { patch.engineBinding = await validateEngineBinding(patch.engineBinding) }
        catch (cause) { throw new CreationError(cause instanceof Error ? cause.message : 'No se pudo vincular esa instalación.', 400) }
      }
    }
    if (patch.engineUrl && new URL(patch.engineUrl).port === new URL(origin).port) throw new z.ZodError([])
    if ('engineUrl' in patch && engine.status === 'checking') throw new z.ZodError([])
    const settings = repository.update(patch)
    if ('engineBinding' in patch || 'modelsDirectory' in patch) { await creation.configurationChanged(); await video.configurationChanged() }
    if ('engineUrl' in patch) { engine = initialEngine(settings.engineUrl); emit('engine') }
    emit('settings'); return settings
  }))
  app.get('/api/v1/setup', async () => setupStateSchema.parse(setup.state()))
  app.post('/api/v1/setup/scan', async (request, reply) => { const input = setupScanSchema.parse(request.body); reply.code(202); return setupStateSchema.parse(setup.scan(input.directory)) })
  app.post('/api/v1/setup/plan', async request => { const input = setupPlanRequestSchema.parse(request.body); return setupPlanSchema.parse(await setup.plan(input.scanId, input.installationId)) })
  app.post('/api/v1/setup/prepare', async (request, reply) => serialized(async () => {
    const input = setupPrepareSchema.parse(request.body)
    creation.assertConfigurationMutable(); video.assertMutable()
    const proposal = await setup.review(input.revision)
    await video.releaseEngine()
    const binding = { directory: proposal.installation.directory, python: proposal.installation.python! }
    if (JSON.stringify(repository.get().engineBinding) !== JSON.stringify(binding)) {
      repository.update({ engineBinding: binding })
      await creation.configurationChanged(); await video.configurationChanged(); emit('settings')
    }
    reply.code(202)
    return creation.prepare(proposal.preparation.revision)
  }))
  app.post('/api/v1/catalog/browse', async request => {
    const input = browseInput.parse(request.body), state = {recommendation:await creation.discoveryRecommendation()}
    if (['unknown', 'unsupported'].includes(state.recommendation.level)) return { results: [], partial: false, nextCursor: null, hardwareReason: state.recommendation.reason }
    try { return await browseCompatible(input.kind, input.cursor) } catch (error) { throw new CreationError(error instanceof Error ? error.message : 'No se pudo consultar el proveedor.', 502) }
  })
  app.post('/api/v1/catalog/search', async request => { const input = discoverInput.parse(request.body); try { return await discover(input.query, input.kind) } catch (error) { throw new CreationError(error instanceof Error ? error.message : 'No se pudo consultar el proveedor.', 502) } })
  app.post('/api/v1/catalog/adopt', async request => serialized(async () => { const input = adoptInput.parse(request.body); try { return await creation.adoptModel(input.repository, input.file, input.strength, input.baseModelId) } catch (error) { if (error instanceof CreationError) throw error; throw new CreationError(error instanceof Error ? error.message : 'No se pudo comprobar el archivo.', 502) } }))
  app.get('/api/v1/catalog/storage', async () => storageSchema.parse(await creation.storage()))
  app.post('/api/v1/catalog/storage/plan', async request => serialized(async () => {video.assertMutable();const input=z.object({id:z.string().length(64)}).strict().parse(request.body);return removalPlanSchema.parse(await creation.removalPlan(input.id))}))
  app.post('/api/v1/catalog/storage/remove', async request => serialized(async () => {video.assertMutable();const input=removalRequestSchema.parse(request.body);return storageSchema.parse(await creation.removeFile(input.id,input.revision,input.acceptShared))}))
  app.get('/api/v1/catalog', async () => catalogSchema.parse(await creation.catalog()))
  app.post('/api/v1/catalog/select', async request => serialized(async () => {
    const input = catalogSelectionSchema.parse(request.body)
    video.assertMutable()
    return creation.selectConfiguration(input.configurationId)
  }))
  app.post('/api/v1/catalog/configurations', async request => creation.importConfiguration(request.body))
  app.get('/api/v1/catalog/configurations/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) }).parse(request.params)
    const entry = creation.configurationEntry(id)
    reply.type('application/json').header('Content-Disposition', `attachment; filename="Veltria-${id}.json"`)
    return JSON.stringify(imageConfigurationSchema.parse(entry.configuration), null, 2)
  })
  app.get('/api/v1/creation', async () => creationStateSchema.parse(await creation.state()))
  app.get('/api/v1/creation/plan', async () => creation.plan())
  app.post('/api/v1/creation/prepare', async (request, reply) => {
    const input = prepareRequestSchema.parse(request.body)
    reply.code(202); return preparationSchema.parse(await withEngine('image', () => creation.prepare(input.revision)))
  })
  app.post('/api/v1/creation/pause', async request => { z.object({}).strict().parse(request.body); return creation.pausePreparation() })
  app.post('/api/v1/jobs', async (request, reply) => { const input = createImageSchema.parse(request.body); reply.code(202); return jobSchema.parse(await withEngine('image', () => creation.create(input))) })
  app.get('/api/v1/jobs', async request => {
    const { offset, limit } = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0), limit: z.coerce.number().int().min(1).max(60).default(24) }).strict().parse(request.query)
    return librarySchema.parse({ jobs: creation.store.jobs(offset, limit), total: creation.store.count(), offset, limit })
  })
  app.get('/api/v1/jobs/:id', async request => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const job = creation.store.job(id); if (!job) throw new CreationError('No se encontró esa creación.', 404)
    return jobSchema.parse(job)
  })
  app.post('/api/v1/jobs/:id/cancel', async request => { const { id } = z.object({ id: z.string().uuid() }).parse(request.params); z.object({}).strict().parse(request.body); return creation.cancel(id) })
  app.post('/api/v1/jobs/:id/reconcile', async request => { const { id } = z.object({ id: z.string().uuid() }).parse(request.params); z.object({}).strict().parse(request.body); return creation.reconcile(id) })
  app.get('/api/v1/artifacts/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const query = z.object({ download: z.enum(['1']).optional() }).strict().parse(request.query)
    reply.type('image/png').header('Content-Disposition', `${query.download ? 'attachment' : 'inline'}; filename="Veltria-${id}.png"`)
    return reply.send(createReadStream(creation.artifact(id)))
  })
  app.get('/api/v1/hardware', async () => detectHardware(options.dataDir))
  app.get('/api/v1/video', async () => video.state())
  app.get('/api/v1/video/plan', async () => video.plan(true))
  app.post('/api/v1/video/prepare', async (request, reply) => { const input = prepareVideoSchema.parse(request.body); reply.code(202); return withEngine('video', () => video.prepare(input.revision)) })
  app.post('/api/v1/video/pause', async request => { z.object({}).strict().parse(request.body); return video.pause() })
  app.post('/api/v1/video/jobs', async (request, reply) => { const input = createVideoSchema.parse(request.body); reply.code(202); return videoJobSchema.parse(await withEngine('video', () => video.create(input))) })
  app.get('/api/v1/video/jobs', async request => { const input = z.object({ offset: z.coerce.number().int().min(0).max(100000).default(0), limit: z.coerce.number().int().min(1).max(60).default(24) }).strict().parse(request.query); return { jobs: video.store.jobs(input.offset, input.limit), total: video.store.count() } })
  app.get('/api/v1/video/jobs/:id', async request => { const { id } = z.object({ id: z.string().uuid() }).parse(request.params); const job = video.store.job(id); if (!job) throw new CreationError('No se encontró ese video.', 404); return job })
  app.post('/api/v1/video/jobs/:id/cancel', async request => { const { id } = z.object({ id: z.string().uuid() }).parse(request.params); z.object({}).strict().parse(request.body); return video.cancel(id) })
  app.post('/api/v1/video/jobs/:id/reconcile', async request => { const { id } = z.object({ id: z.string().uuid() }).parse(request.params); z.object({}).strict().parse(request.body); return video.reconcile(id) })
  app.get('/api/v1/video/artifacts/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params), query = z.object({ download: z.enum(['1']).optional() }).strict().parse(request.query)
    const path = video.artifact(id), info = await stat(path), range = request.headers.range
    reply.type('video/mp4').header('Accept-Ranges', 'bytes').header('Content-Disposition', `${query.download ? 'attachment' : 'inline'}; filename="Veltria-${id}.mp4"`)
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      let start = 0, end = info.size - 1
      if (match && (match[1] || match[2])) { start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2])); end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end }
      if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= info.size || !match[1] && Number(match[2]) === 0) return reply.code(416).header('Content-Range', `bytes */${info.size}`).send()
      reply.code(206).header('Content-Range', `bytes ${start}-${end}/${info.size}`).header('Content-Length', end - start + 1)
      return reply.send(createReadStream(path, { start, end }))
    }
    reply.header('Content-Length', info.size); return reply.send(createReadStream(path))
  })
  app.get('/api/v1/resources', async () => resources.sample())
  app.get('/api/v1/engine', async () => engineSchema.parse(engine))
  app.post('/api/v1/engine/check', async (_request, reply) => {
    if (!engine.url) return error(reply, 409, 'ENGINE', 'Guarda primero la dirección de una instalación existente.')
    if (engine.status === 'checking') return error(reply, 409, 'BUSY', 'Ya se está comprobando esta conexión.')
    engine = { ...initialEngine(engine.url), status: 'checking', message: 'Consultando la API local de ComfyUI…' }; emit('engine')
    engine = await probeComfy(engine.url!, engineAbort.signal); emit('engine'); return engineSchema.parse(engine)
  })
  app.get('/api/v1/events', async (request: FastifyRequest, reply) => {
    if (streams.size >= 64) return error(reply, 429, 'STREAMS', 'Demasiadas conexiones de eventos.')
    reply.hijack()
    const stream = reply.raw
    stream.socket?.setTimeout(0)
    stream.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' })
    stream.write(`retry: 1500\ndata: ${JSON.stringify({ sequence, kind: 'connected', instanceId: options.instanceId })}\n\n`)
    streams.set(stream, sessions.get(request.cookies.veltria_session!)!.expires)
    stream.on('close', () => streams.delete(stream))
  })
  const heartbeat = setInterval(() => {
    for (const [stream, expires] of streams) {
      if (expires <= Date.now() || stream.writableLength > 64_000) stream.end()
      else stream.write(': heartbeat\n\n')
    }
  }, 15_000)
  heartbeat.unref()
  await app.register(staticFiles, { root: options.uiDir, index: ['index.html'], dotfiles: 'deny', cacheControl: false })
  app.setNotFoundHandler((_request, reply) => error(reply, 404, 'NOT_FOUND', 'Ruta no disponible en este hito.'))
  app.addHook('onClose', () => { clearInterval(heartbeat); repository.close() })
  return {
    app, repository, issueNonce,
    async listen(port = 0) { origin = await app.listen({ host: '127.0.0.1', port }); return origin },
    get streamCount() { return streams.size },
    async close() {
      if (closing) return
      closing = true; engineAbort.abort()
      await Promise.all([setup.close(), creation.close(), video.close()])
      for (const stream of streams.keys()) stream.end()
      streams.clear()
      await app.close()
    }
  }
}
