import { test, expect } from 'bun:test'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from '../apps/local-service/src/server'
import { CreationFixture, fixtureHardware } from './creation-fixture'
const waitFor = async <T>(work: () => Promise<T>, predicate: (value: T) => boolean, ms = 10000): Promise<T> => {
  const deadline = Date.now() + ms
  do { const value = await work(); if (predicate(value)) return value; await Bun.sleep(25) } while (Date.now() < deadline)
  throw new Error('Estado esperado no alcanzado')
}
async function setup(multiple = false, adaptation = false, xl = false) {
  const root = await mkdtemp(join(tmpdir(), 'Veltria image contract with spaces ')), ui = join(root, 'UI')
  await mkdir(ui); await writeFile(join(ui, 'index.html'), '<title>fixture</title>')
  const fixture = new CreationFixture(), binding = await fixture.binding(root)
  const create = async () => {
    const server = await createServer({ dataDir: root, uiDir: ui, instanceId: crypto.randomUUID(), controlToken: 'a'.repeat(64), creation: { profile: fixture.profile, ...(multiple ? { profiles: [fixture.profile, { ...fixture.profile, id: 'fixture-second', title: 'Segundo modelo de prueba', filename: 'fixture-second.safetensors', revision: 'second-v1' }, ...(xl ? [{...fixture.profile,id:'fixture-xl',filename:'fixture-xl.safetensors',family:'sdxl' as const,width:768,height:768}] : []), ...(adaptation ? [{ ...fixture.profile, id: 'fixture-lora', filename: 'fixture-lora.safetensors', adaptation: { base: fixture.profile.id, strength: 0.7 } }] : [])] } : {}), hardware: async () => fixtureHardware, disk: async () => fixture.availableBytes, engine: fixture.engine, allowLocalFixture: true } })
    const origin = await server.listen()
    const bootstrap = await fetch(`${origin}/api/v1/session`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ nonce: server.issueNonce() }) })
    const session: any = await bootstrap.json(), cookie = bootstrap.headers.get('set-cookie')!.split(';')[0]
    const headers = { cookie, origin, 'content-type': 'application/json', 'x-veltria-csrf': session.csrf }
    const call = (path: string, method = 'GET', body?: unknown) => fetch(`${origin}/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const json = async (path: string) => (await call(path)).json() as any
    return { server, origin, call, json, headers }
  }
  const connection = await create()
  return { ...connection, root, fixture, binding, create, async cleanup() { await connection.server.close(); fixture.stop(); await rm(root, { recursive: true, force: true }) } }
}
test('primera imagen: plan autorizado, Range/pausa, SHA, trabajo idempotente y biblioteca persistente', async () => {
  const ctx = await setup()
  try {
    expect((await ctx.call('/creation/prepare', 'POST', { revision: 'a'.repeat(64), acceptLicense: false })).status).toBe(400)
    expect((await ctx.json('/creation/plan')).canPrepare).toBe(false)
    expect((await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })).status).toBe(200)
    await ctx.call('/settings', 'PATCH', { theme: 'dark' })
    expect((await ctx.json('/settings')).engineBinding).toEqual(ctx.binding)
    const plan = await ctx.json('/creation/plan')
    expect(plan.totalBytes).toBe(ctx.fixture.bytes.length); expect(plan.canPrepare).toBe(true)
    expect((await ctx.call('/creation/prepare', 'POST', { revision: 'b'.repeat(64), acceptLicense: true })).status).toBe(409)
    expect((await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })).status).toBe(202)
    await waitFor(() => ctx.json('/creation'), state => state.preparation.received > 0)
    expect((await ctx.call('/settings', 'PATCH', { locale: 'en' })).status).toBe(200)
    expect((await ctx.json('/creation')).preparation.revision).toBe(plan.revision)
    expect((await ctx.call('/settings', 'PATCH', { modelsDirectory: join(ctx.root, 'other') })).status).toBe(409)
    await ctx.call('/creation/pause', 'POST', {})
    const paused = await ctx.json('/creation')
    expect(paused.preparation.status).toBe('paused')
    expect(paused.preparation.received).toBeGreaterThan(0)
    expect((await ctx.json('/creation/plan')).revision).toBe(plan.revision)
    await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    await waitFor(() => ctx.json('/creation'), state => state.canCreate)
    expect(ctx.fixture.ranges.length).toBeGreaterThan(0)
    const requestId = crypto.randomUUID(), input = { requestId, prompt: 'An amber stone arch, quiet desert, dawn', format: 'square' }
    const responses = await Promise.all([ctx.call('/jobs', 'POST', input), ctx.call('/jobs', 'POST', input)])
    const jobs: any[] = await Promise.all(responses.map(r => r.json()))
    expect(jobs[0].id).toBe(jobs[1].id)
    const completed = await waitFor(() => ctx.json(`/jobs/${jobs[0].id}`), job => job.status === 'completed')
    expect(ctx.fixture.submissions).toHaveLength(1)
    expect(ctx.fixture.submissions[0].prompt['2'].inputs.text).toBe(input.prompt)
    expect(ctx.fixture.submissions[0].prompt['4'].inputs.batch_size).toBe(1)
    expect((await ctx.call('/jobs', 'POST', { ...input, prompt: 'different input' })).status).toBe(409)
    const image = await ctx.call(`/artifacts/${completed.imageId}?download=1`)
    expect(image.headers.get('content-type')).toContain('image/png'); expect(image.headers.get('content-disposition')).toContain('attachment')
    expect(Buffer.from(await image.arrayBuffer()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect((await fetch(`${ctx.origin}/api/v1/artifacts/${completed.imageId}`)).status).toBe(401)
    expect((await ctx.call('/artifacts/../../settings.sqlite')).status).not.toBe(200)
    expect((await ctx.json('/jobs')).total).toBe(1)
    expect((await ctx.json('/creation')).recommendation.verified).toBe(true)
    await ctx.server.close()
    const reopened = await ctx.create()
    try {
      expect((await reopened.json('/settings')).theme).toBe('dark')
      expect((await reopened.json('/settings')).locale).toBe('en')
      expect((await reopened.json('/settings')).engineBinding).toEqual(ctx.binding)
      expect((await reopened.json('/jobs')).jobs[0].prompt).toBe(input.prompt)
      expect((await reopened.call(`/artifacts/${completed.imageId}`)).status).toBe(200)
      expect((await reopened.json('/creation')).canCreate).toBe(true)
    } finally { await reopened.server.close() }
  } finally { await ctx.cleanup() }
}, 20000)

test('corrupción: un hash incorrecto impide preparar y no permite crear', async () => {
  const ctx = await setup(); ctx.fixture.wrongHash = true; ctx.fixture.downloadDelay = 1
  try {
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })
    const plan = await ctx.json('/creation/plan')
    await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    const state = await waitFor(() => ctx.json('/creation'), state => state.preparation.status === 'error')
    expect(state.preparation.message).toContain('SHA-256'); expect(state.canCreate).toBe(false)
    expect((await ctx.call('/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'test' })).status).toBe(409)
  } finally { await ctx.cleanup() }
})

test('cancelación por identificador y fallo del motor conservan descripción y no repiten trabajos', async () => {
  const ctx = await setup(); ctx.fixture.complete = false; ctx.fixture.downloadDelay = 1
  try {
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })
    const plan = await ctx.json('/creation/plan'); await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    await waitFor(() => ctx.json('/creation'), state => state.canCreate)
    const job: any = await (await ctx.call('/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'Preserve this description', format: 'portrait' })).json()
    await waitFor(() => ctx.json(`/jobs/${job.id}`), state => state.status === 'running')
    expect((await ctx.call(`/jobs/${job.id}/cancel`, 'POST', {})).status).toBe(200)
    expect(ctx.fixture.cancellations).toEqual([job.id])
    expect((await ctx.json(`/jobs/${job.id}`)).prompt).toBe('Preserve this description')
    expect((await ctx.json(`/jobs/${job.id}`)).status).toBe('cancelled')
    await waitFor(() => ctx.json('/activity'), state => state.jobs === 0)
    ctx.fixture.complete = true; ctx.fixture.failure = true
    const failed: any = await (await ctx.call('/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'Another preserved description' })).json()
    await waitFor(() => ctx.json(`/jobs/${failed.id}`), state => state.status === 'failed')
    expect((await ctx.json(`/jobs/${failed.id}`)).prompt).toBe('Another preserved description')
    const count = ctx.fixture.submissions.length; await Bun.sleep(200); expect(ctx.fixture.submissions).toHaveLength(count)
  } finally { await ctx.cleanup() }
})

test('preparar conserva un archivo distinto preexistente y valida ubicación y vínculo', async () => {
  const ctx = await setup()
  try {
    expect((await ctx.call('/settings', 'PATCH', { engineBinding: { directory: ctx.root, python: '/missing/python' } })).status).toBe(400)
    expect((await ctx.call('/settings', 'PATCH', { modelsDirectory: 'relative/path' })).status).toBe(400)
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })
    const plan = await ctx.json('/creation/plan'); await mkdir(join(ctx.root, 'models', 'checkpoints'), { recursive: true }); await writeFile(plan.destination, 'existing work')
    expect((await ctx.json('/creation/plan')).canPrepare).toBe(false)
    expect((await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })).status).toBe(409)
    expect(await readFile(plan.destination, 'utf8')).toBe('existing work')
  } finally { await ctx.cleanup() }
})


test('origen sin Range: continuar reinicia de forma segura sin duplicar bytes', async () => {
  const ctx = await setup(); ctx.fixture.ignoreRange = true
  try {
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })
    const plan = await ctx.json('/creation/plan')
    await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    await waitFor(() => ctx.json('/creation'), state => state.preparation.received > 0)
    await ctx.call('/creation/pause', 'POST', {})
    await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    await waitFor(() => ctx.json('/creation'), state => state.canCreate)
    expect(ctx.fixture.ranges.length).toBeGreaterThan(0)
    expect((await ctx.json('/creation')).preparation.received).toBe(ctx.fixture.bytes.length)
    expect((await readFile(plan.destination)).length).toBe(ctx.fixture.bytes.length)
  } finally { await ctx.cleanup() }
})

test('reinicio tras enviar: conserva el trabajo sin reenviar y recupera su resultado', async () => {
  const ctx = await setup(); ctx.fixture.complete = false; ctx.fixture.downloadDelay = 1
  try {
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })
    const plan = await ctx.json('/creation/plan'); await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    await waitFor(() => ctx.json('/creation'), state => state.canCreate)
    const job: any = await (await ctx.call('/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'Keep my interrupted input' })).json()
    await waitFor(() => ctx.json(`/jobs/${job.id}`), state => state.status === 'running')
    await ctx.server.close()
    const reopened = await ctx.create()
    try {
      expect((await reopened.json(`/jobs/${job.id}`)).status).toBe('interrupted')
      const count = ctx.fixture.submissions.length
      ctx.fixture.complete = true
      const recovery = await reopened.call(`/jobs/${job.id}/reconcile`, 'POST', {})
      expect(recovery.status).toBe(200)
      expect((await recovery.json() as any).status).toBe('completed')
      expect(ctx.fixture.submissions).toHaveLength(count)
      expect((await reopened.json(`/jobs/${job.id}`)).prompt).toBe('Keep my interrupted input')
    } finally { await reopened.server.close() }
  } finally { await ctx.cleanup() }
})

test('espacio insuficiente: el plan bloquea la descarga antes de contactar el origen', async () => {
  const ctx = await setup(); ctx.fixture.availableBytes = ctx.fixture.bytes.length - 1
  try {
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })
    const plan = await ctx.json('/creation/plan')
    expect(plan.canPrepare).toBe(false)
    expect(plan.blockers.join(' ')).toContain('espacio suficiente')
    expect((await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })).status).toBe(409)
    expect(ctx.fixture.downloads).toBe(0)
  } finally { await ctx.cleanup() }
})


test('catálogo: descarga por modelo, configura sin redescargar, importa/exporta y persiste selección y ajustes ejecutados', async () => {
  const ctx = await setup(true)
  try {
    expect((await fetch(`${ctx.origin}/api/v1/catalog`)).status).toBe(401)
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding, locale: 'en' })
    const initial = await ctx.json('/catalog')
    expect(initial.models).toHaveLength(2)
    expect(initial.models.every((item: any) => item.status === 'missing')).toBe(true)
    const firstId = initial.selectedConfigurationId, secondId = 'fixture-second-balanced'
    const plan = await ctx.json('/creation/plan')
    await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    await waitFor(() => ctx.json('/creation'), state => state.preparation.received > 0)
    expect((await ctx.call('/catalog/select', 'POST', { configurationId: secondId })).status).toBe(409)
    await ctx.call('/creation/pause', 'POST', {})
    const paused = await ctx.json('/creation')
    await ctx.call('/catalog/select', 'POST', { configurationId: secondId })
    expect((await ctx.json('/creation')).canCreate).toBe(false)
    expect((await ctx.json('/creation/plan')).remainingBytes).toBe(ctx.fixture.bytes.length)
    await ctx.call('/catalog/select', 'POST', { configurationId: firstId })
    expect((await ctx.json('/creation')).preparation.received).toBe(paused.preparation.received)
    expect((await ctx.json('/creation/plan')).revision).toBe(plan.revision)
    expect((await ctx.json('/creation/plan')).remainingBytes).toBeLessThan(plan.remainingBytes)
    ctx.fixture.downloadDelay = 1
    await ctx.call('/creation/prepare', 'POST', { revision: plan.revision, acceptLicense: true })
    await waitFor(() => ctx.json('/creation'), state => state.canCreate)
    expect((await ctx.json('/catalog')).models[0].status).toBe('prepared')
    const exported = await ctx.call(`/catalog/configurations/${firstId}`)
    expect(exported.headers.get('content-disposition')).toContain('.json')
    const configuration = { ...await exported.json() as any, name: 'Crear imagen 日本語', parameters: { steps: 12, cfg: 5.5, sampler: 'euler', scheduler: 'normal', format: 'landscape' } }
    for (const invalid of [
      { ...configuration, modelId: '../escape' }, { ...configuration, modelId: 'unknown-model' },
      { ...configuration, url: 'https://example.com/model' }, { ...configuration, nodes: {} },
      { ...configuration, recipe: 'unreviewed-workflow' }, { ...configuration, parameters: { ...configuration.parameters, steps: 999 } }
    ]) expect((await ctx.call('/catalog/configurations', 'POST', invalid)).status).toBe(400)
    const imported: any = await (await ctx.call('/catalog/configurations', 'POST', configuration)).json()
    expect((await (await ctx.call('/catalog/configurations', 'POST', configuration)).json() as any).id).toBe(imported.id)
    const downloads = ctx.fixture.downloads
    const selected: any = await (await ctx.call('/catalog/select', 'POST', { configurationId: imported.id })).json()
    expect(selected.canCreate).toBe(true); expect(selected.configuration.format).toBe('landscape')
    expect(selected.recommendation.verified).toBe(false)
    const exportedAgain = await ctx.call(`/catalog/configurations/${imported.id}`)
    expect(await exportedAgain.json()).toEqual(configuration)
    ctx.fixture.complete = false
    const job: any = await (await ctx.call('/jobs', 'POST', { requestId: crypto.randomUUID(), prompt: 'Keep this exact prompt', format: selected.configuration.format })).json()
    await waitFor(() => ctx.json(`/jobs/${job.id}`), state => state.status === 'running')
    expect((await ctx.call('/catalog/select', 'POST', { configurationId: firstId })).status).toBe(409)
    ctx.fixture.complete = true
    const completed = await waitFor(() => ctx.json(`/jobs/${job.id}`), state => state.status === 'completed')
    const workflow = ctx.fixture.submissions.at(-1).prompt
    expect(workflow['5'].inputs.steps).toBe(12); expect(workflow['5'].inputs.cfg).toBe(5.5)
    expect(workflow['2'].inputs.text).toBe('Keep this exact prompt')
    expect(workflow['4'].inputs).toMatchObject({ width: 512, height: 384, batch_size: 1 })
    expect(completed.configurationId).toBe(imported.id); expect(completed.configurationName).toBe(configuration.name)
    expect(ctx.fixture.downloads).toBe(downloads)
    expect((await ctx.json('/creation')).recommendation.verified).toBe(true)
    await waitFor(() => ctx.json('/activity'), activity => activity.jobs === 0)
    await ctx.call('/catalog/select', 'POST', { configurationId: firstId })
    expect((await ctx.json('/creation')).recommendation.verified).toBe(false)
    await ctx.call('/catalog/select', 'POST', { configurationId: imported.id })
    await ctx.server.close()
    const reopened = await ctx.create()
    try {
      expect((reopened.server.repository.db.query('PRAGMA user_version').get() as any).user_version).toBe(4)
      expect((await reopened.json('/catalog')).selectedConfigurationId).toBe(imported.id)
      expect((await reopened.json('/catalog')).configurations.filter((item: any) => item.origin === 'imported')).toHaveLength(1)
      expect((await reopened.json('/creation')).canCreate).toBe(true)
      expect((await reopened.json('/creation')).configuration.name).toBe(configuration.name)
      expect((await reopened.json(`/jobs/${job.id}`)).cfg).toBe(5.5)
      // A second downloaded model has its own receipt and never inherits the first one's ready state.
      await reopened.call('/catalog/select', 'POST', { configurationId: secondId })
      const secondPlan = await reopened.json('/creation/plan')
      await reopened.call('/creation/prepare', 'POST', { revision: secondPlan.revision, acceptLicense: true })
      await waitFor(() => reopened.json('/creation'), state => state.canCreate)
      expect((await reopened.json('/catalog')).models.every((item: any) => item.status === 'prepared')).toBe(true)
      expect(await readFile(plan.destination)).toEqual(ctx.fixture.bytes)
    } finally { await reopened.server.close() }
  } finally { await ctx.cleanup() }
}, 25000)

test('LoRA: un plan prepara base y adaptación, reusa archivos y envía el conjunto al motor', async () => {
  const ctx = await setup(true, true)
  try {
    await ctx.call('/settings', 'PATCH', { engineBinding: ctx.binding })
    await ctx.call('/catalog/select', 'POST', { configurationId: 'fixture-lora-balanced' })
    const plan = await ctx.json('/creation/plan')
    expect(plan.totalBytes).toBe(ctx.fixture.bytes.length * 2)
    expect(plan.remainingBytes).toBe(plan.totalBytes)
    await ctx.call('/creation/prepare', 'POST', {revision: plan.revision, acceptLicense: true})
    await waitFor(() => ctx.json('/creation'), state => state.canCreate)
    expect((await ctx.json('/creation/plan')).remainingBytes).toBe(0)
    const response = await ctx.call('/jobs', 'POST', {requestId: crypto.randomUUID(), prompt: 'fixture adaptation', format: 'square'})
    const job: any = await response.json()
    const done = await waitFor(() => ctx.json('/jobs/' + job.id), value => ['completed', 'failed'].includes(value.status))
    expect(done.status).toBe('completed')
    const graph = ctx.fixture.submissions.at(-1).prompt
    expect(graph['1'].inputs.ckpt_name).toBe(ctx.fixture.profile.filename)
    expect(graph['8'].inputs.lora_name).toBe('fixture-lora.safetensors')
    expect(graph['5'].inputs.model).toEqual(['8', 0])
  } finally { await ctx.cleanup() }
})

test('gestión: retirar LoRA conserva base y biblioteca; retirar base compartida exige confirmación',async()=>{
 const ctx=await setup(true,true)
 try{
  await ctx.call('/settings','PATCH',{engineBinding:ctx.binding})
  await ctx.call('/catalog/select','POST',{configurationId:'fixture-lora-balanced'})
  const prepare=await ctx.json('/creation/plan');await ctx.call('/creation/prepare','POST',{revision:prepare.revision,acceptLicense:true})
  await waitFor(()=>ctx.json('/creation'),state=>state.canCreate)
  const created:any=await(await ctx.call('/jobs','POST',{requestId:crypto.randomUUID(),prompt:'storage fixture',format:'square'})).json()
  await waitFor(()=>ctx.json('/jobs/'+created.id),job=>job.status==='completed')
  const completed=await ctx.json('/jobs/'+created.id)
  const inventory=await ctx.json('/catalog/storage');expect(inventory.files).toHaveLength(2)
  ctx.server.repository.db.query('UPDATE image_jobs SET data=? WHERE id=?').run(JSON.stringify({...completed,status:'interrupted'}),created.id)
  expect((await ctx.call('/catalog/storage/plan','POST',{id:inventory.files[0].id})).status).toBe(409)
  ctx.server.repository.db.query('UPDATE image_jobs SET data=? WHERE id=?').run(JSON.stringify(completed),created.id)
  const base=inventory.files.find((item:any)=>item.kind==='checkpoint'),lora=inventory.files.find((item:any)=>item.kind==='lora')
  const basePlan:any=await(await ctx.call('/catalog/storage/plan','POST',{id:base.id})).json()
  expect((await ctx.call('/catalog/storage/remove','POST',{id:base.id,revision:basePlan.revision})).status).toBe(409)
  const loraPlan:any=await(await ctx.call('/catalog/storage/plan','POST',{id:lora.id})).json()
  expect((await ctx.call('/catalog/storage/remove','POST',{id:lora.id,revision:loraPlan.revision})).status).toBe(200)
  const remaining=await ctx.json('/catalog/storage');expect(remaining.files).toHaveLength(1);expect(remaining.files[0].id).toBe(base.id)
  expect((await ctx.json('/creation')).canCreate).toBe(false)
  expect((await ctx.json('/jobs/'+created.id)).status).toBe('completed')
  const finalPlan:any=await(await ctx.call('/catalog/storage/plan','POST',{id:base.id})).json()
  expect((await ctx.call('/catalog/storage/remove','POST',{id:base.id,revision:finalPlan.revision,acceptShared:true})).status).toBe(200)
  expect((await ctx.json('/catalog/storage')).files).toHaveLength(0)
 }finally{await ctx.cleanup()}
})

test('SDXL: receta propia, memoria reducida, dimensiones reales y rechazo de recetas cruzadas',async()=>{
 const ctx=await setup(true,false,true)
 try{
  await ctx.call('/settings','PATCH',{engineBinding:ctx.binding})
  const catalog=await ctx.json('/catalog'), configuration=catalog.configurations.find((item:any)=>item.id==='fixture-xl-balanced').configuration
  expect(configuration.recipe).toBe('sdxl-text-to-image-v1')
  expect((await ctx.call('/catalog/adopt','POST',{repository:'fixture/test',file:'style.safetensors',baseModelId:'fixture-xl'})).status).toBe(409)
  expect((await ctx.call('/catalog/configurations','POST',{...configuration,modelId:ctx.fixture.profile.id})).status).toBe(400)
  expect((await ctx.call('/catalog/configurations','POST',{...configuration,recipe:'sd15-text-to-image-v1'})).status).toBe(400)
  await ctx.call('/catalog/select','POST',{configurationId:'fixture-xl-balanced'})
  const plan=await ctx.json('/creation/plan');expect(plan.canPrepare).toBe(true)
  await ctx.call('/creation/prepare','POST',{revision:plan.revision,acceptLicense:true})
  await waitFor(()=>ctx.json('/creation'),state=>state.canCreate)
  expect(ctx.fixture.memoryModes.at(-1)).toBe('lowvram')
  const job:any=await(await ctx.call('/jobs','POST',{requestId:crypto.randomUUID(),prompt:'SDXL fixture',format:'landscape'})).json()
  expect(job.width).toBe(768);expect(job.height).toBe(576)
  await waitFor(()=>ctx.json('/jobs/'+job.id),value=>value.status==='completed')
  expect(ctx.fixture.submissions.at(-1).prompt['4'].inputs.width).toBe(768)
 }finally{await ctx.cleanup()}
})
