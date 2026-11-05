// Opt-in native integration. Real provider traffic and GPU inference, never part of `bun run test`.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { createHash, randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const { chromium } = require(path.join(root, 'node_modules/.bun/playwright-core@1.64.1/node_modules/playwright-core'));
const dream = { id: 'dreamshaper-8', filename: 'veltria-dreamshaper8-879db523.safetensors', bytes: 2132625894, sha256: '879db523c30d3b9017143d56705015e15a2cb5628762c11d086fed9538abd7fd', url: 'https://huggingface.co/Lykon/DreamShaper/resolve/228d79cb20811466f5c5710aa91f05dabd0b8a14/DreamShaper_8_pruned.safetensors' };
const sd15 = { id: 'sd15-starter', filename: 'veltria-sd15-e9476a13.safetensors', bytes: 2132696762, sha256: 'e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916' };
const sourceModels = process.argv[2];
assert.equal(process.platform, 'win32', 'This validation needs native Windows');
assert.ok(sourceModels && path.isAbsolute(sourceModels), 'An existing models directory is required');
const continuation = process.argv[3];
if (continuation) { assert.ok(path.isAbsolute(continuation)); assert.equal(path.dirname(continuation).toLowerCase(), path.join(process.env.LOCALAPPDATA, 'Veltria').toLowerCase()); assert.ok(path.basename(continuation).startsWith('catalog-real-')); }
const previous = continuation ? JSON.parse(fs.readFileSync(path.join(continuation, 'validated-catalog.json'), 'utf8')) : null;
const stamp = previous ? path.basename(continuation).slice('catalog-real-'.length) : new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
const dataDir = continuation || path.join(process.env.LOCALAPPDATA, 'Veltria', 'catalog-real-' + stamp);
const scratchRoot = path.join(path.dirname(sourceModels), 'validation', 'catalog-real-' + stamp);
if (previous) { assert.equal(previous.kind, 'real-native-catalog-validation'); assert.equal(previous.version, version); assert.equal(previous.sourceModels.toLowerCase(), sourceModels.toLowerCase()); assert.equal(previous.scratchRoot.toLowerCase(), scratchRoot.toLowerCase()); assert.equal(previous.finishedSha256, dream.sha256, 'Continuation requires a completed verified transfer'); }
const models = path.join(scratchRoot, 'models');
const checkpoint = path.join(models, 'checkpoints', dream.filename), partial = checkpoint + '.part';
const seedBytes = dream.bytes - 256 * 1024 ** 2;
const record = previous || { version, platform: process.platform, kind: 'real-native-catalog-validation', startedAt: new Date().toISOString(), dataDir, scratchRoot, model: dream, sourceModels, seededLocally: true, seededBytes: seedBytes, jobs: [], checkpoints: [] };
if (previous) { (record.validationAttempts ||= []).push({ at: new Date().toISOString(), previousResult: record.result, error: record.error || null }); delete record.error; record.result = 'running'; }
let service = null, browser = null, context = null, page = null, succeeded = false;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, done, timeout = 20000) {
  const end = Date.now() + timeout;
  do { const value = await read(); if (done(value)) return value; await sleep(80); } while (Date.now() < end);
  throw new Error('Expected validation state was not reached');
}
async function sha256(file) { const hash = createHash('sha256'); for await (const chunk of fs.createReadStream(file, { highWaterMark: 1024 * 1024 })) hash.update(chunk); return hash.digest('hex'); }
async function saveRecord() { await fsp.writeFile(path.join(dataDir, 'validated-catalog.json'), JSON.stringify(record, null, 2)); }
function note(message) { console.log(message); }
async function startService() {
  const env = { ...process.env, VELTRIA_DATA_DIR: dataDir }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(path.join(root, 'build/browser', version, 'veltria-web.exe'), [], { env, cwd: root, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', chunk => fsp.appendFile(path.join(dataDir, 'launcher-errors.log'), String(chunk)).catch(() => {}));
  const launch = await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error('Native launcher timeout')), 20000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Native launcher exited before ready')); });
    child.stdout.on('data', chunk => { output += String(chunk); if (output.length > 8192) return reject(new Error('Unexpected launcher output')); const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/#launch=[a-f0-9]{64}/); if (match) { clearTimeout(timer); resolve(new URL(match[0])); } });
  });
  const descriptor = JSON.parse(await fsp.readFile(path.join(dataDir, '.service-lock/instance.json'), 'utf8'));
  assert.equal(descriptor.origin, launch.origin); assert.equal(descriptor.platform, 'win32');
  service = { child, descriptor, launch };
  return service;
}
async function stopService() {
  if (!service) return;
  const owned = service;
  const identity = await fetch(owned.descriptor.origin + '/api/v1/identity').then(r => r.json());
  assert.equal(identity.instanceId, owned.descriptor.instanceId, 'Never stop a different service');
  await fetch(owned.descriptor.origin + '/api/v1/control/shutdown', { method: 'POST', headers: { 'x-veltria-control': owned.descriptor.controlToken }, signal: AbortSignal.timeout(4000) });
  await until(async () => { try { await fsp.access(path.join(dataDir, '.service-lock')); return false; } catch (e) { if (e.code !== 'ENOENT') throw e; return true; } }, Boolean, 20000);
  if (owned.child.exitCode === null) await new Promise(resolve => { const timer = setTimeout(resolve, 3000); owned.child.once('exit', () => { clearTimeout(timer); resolve(); }); });
  service = null;
}
async function authorizePage() {
  if (page) await page.close();
  await context.clearCookies();
  page = await context.newPage();
  page.on('pageerror', error => { (record.pageErrors ||= []).push(error.message); });
  await page.goto(service.launch.href);
  await page.getByText('Servicio local conectado', { exact: true }).waitFor();
}
async function api(route, method = 'GET', body) {
  return page.evaluate(async ({ route, method, body }) => {
    const session = method !== 'GET' ? await fetch('/api/v1/session').then(r => r.json()) : null;
    const response = await fetch('/api/v1' + route, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'content-type': 'application/json', 'x-veltria-csrf': session.csrf }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.message}`); return data;
  }, { route, method, body });
}
async function rangeProbe(offset) {
  const response = await fetch(dream.url, { headers: { Range: `bytes=${offset}-`, 'accept-encoding': 'identity' }, signal: AbortSignal.timeout(30000) });
  const proof = { offset, status: response.status, contentRange: response.headers.get('content-range'), length: response.headers.get('content-length'), host: new URL(response.url).hostname };
  await response.body?.cancel();
  assert.equal(proof.status, 206, 'Refuse a full download if the provider ignores Range');
  assert.equal(proof.contentRange, `bytes ${offset}-${dream.bytes - 1}/${dream.bytes}`);
  return proof;
}
async function ready(configurationId) {
  return until(async () => { const state = await api('/creation'); if (state.preparation.status === 'error') throw new Error(state.preparation.message); return state; }, state => state.canCreate && (!configurationId || state.configuration.id === configurationId), 180000);
}
async function chooseConfiguration(model, suffix) {
  await page.locator('.sidebar nav').getByRole('button', { name: 'Modelos', exact: true }).click();
  const row = page.locator('.model-row').filter({ hasText: model.id === dream.id ? 'DreamShaper 8' : 'Stable Diffusion 1.5' });
  await row.locator('select').selectOption(model.id + '-' + suffix);
  const before = await api('/catalog');
  const status = before.models.find(item => item.profile.id === model.id).status;
  await row.locator('button.primary-button').click();
  await until(() => api('/creation'), state => state.configuration.id === model.id + '-' + suffix);
  if (status !== 'prepared') {
    const plan = await api('/creation/plan'); assert.equal(plan.remainingBytes, 0, 'Other profiles reuse local weights');
    const dialog = page.getByRole('dialog'); await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Comprobar y preparar', exact: true }).click();
  }
  await ready(model.id + '-' + suffix);
  const selected = await api('/creation'); assert.equal(selected.configuration.id, model.id + '-' + suffix);
}
async function generate(model, suffix, steps) {
  await page.getByLabel('Describe lo que imaginas').fill('A small cozy cottage among autumn trees, warm afternoon light, a stone path, detailed illustration');
  const response = page.waitForResponse(response => response.url().endsWith('/api/v1/jobs') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear imagen', exact: true }).click();
  const submitted = await response; assert.equal(submitted.status(), 202); const job = await submitted.json();
  const completed = await until(async () => { const current = await api('/jobs/' + job.id); if (['failed', 'interrupted', 'cancelled'].includes(current.status)) throw new Error(current.message); return current; }, current => current.status === 'completed', 240000);
  assert.equal(completed.profileId, model.id); assert.equal(completed.configurationId, model.id + '-' + suffix);
  assert.equal(completed.steps, steps); assert.equal(completed.cfg, 7); assert.equal(completed.width, 512); assert.equal(completed.height, 512);
  const state = await api('/creation'); assert.equal(state.recommendation.verified, true);
  await page.getByRole('link', { name: 'Guardar imagen', exact: true }).waitFor();
  const download = page.waitForEvent('download'); await page.getByRole('link', { name: 'Guardar imagen', exact: true }).click();
  const result = await download, saved = path.join(dataDir, `${model.id}-${suffix}.png`); await result.saveAs(saved);
  const header = Buffer.alloc(24), handle = await fsp.open(saved, 'r'); try { await handle.read(header, 0, 24, 0); } finally { await handle.close(); }
  assert.equal(header.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); assert.equal(header.readUInt32BE(16), 512); assert.equal(header.readUInt32BE(20), 512);
  record.jobs.push({ ...completed, savedDownload: saved, sha256: await sha256(saved) });
  await page.screenshot({ path: path.join(dataDir, `${model.id}-${suffix}-ui.png`), fullPage: true });
  await saveRecord(); note(`REAL IMAGE PASS: ${model.id}/${suffix}, ${steps} steps, 512x512, ${completed.engineVersion}`);
}
(async () => {
  await fsp.mkdir(dataDir, { recursive: true }); await fsp.mkdir(path.dirname(partial), { recursive: true });
  const source = path.join(sourceModels, 'checkpoints', dream.filename);
  if (previous) {
    assert.equal(await sha256(checkpoint), dream.sha256);
    await startService();
    browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--disable-gpu'] });
    context = await browser.newContext({ viewport: { width: 1363, height: 900 }, acceptDownloads: true });
    await authorizePage();
    note('Continuing verified catalog validation; completed images will be checked, not regenerated.');
  } else {
  note('Checking the existing DreamShaper file; the original is opened read-only.');
  const original = await fsp.stat(source); assert.equal(original.size, dream.bytes);
  assert.equal(await sha256(source), dream.sha256);
  record.original = { bytes: original.size, modified: original.mtimeMs, sha256: dream.sha256 };
  record.rangeBeforePause = await rangeProbe(seedBytes);
  await pipeline(fs.createReadStream(source, { start: 0, end: seedBytes - 1, highWaterMark: 4 * 1024 ** 2 }), fs.createWriteStream(partial, { flags: 'wx' }));
  record.seededBytes = (await fsp.stat(partial)).size; assert.equal(record.seededBytes, seedBytes);
  await startService();
  browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--disable-gpu'] });
  context = await browser.newContext({ viewport: { width: 1363, height: 900 }, acceptDownloads: true });
  await authorizePage();
  await api('/settings', 'PATCH', { modelsDirectory: models, locale: 'es', theme: 'dark' });
  await page.locator('.sidebar nav').getByRole('button', { name: 'Modelos', exact: true }).click();
  const row = page.locator('.model-row').filter({ hasText: 'DreamShaper 8' });
  await row.getByRole('button', { name: 'Continuar preparación', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preparar mi equipo', exact: true });
  await dialog.getByText('Usaremos lo que ya tienes', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal((await api('/settings')).engineBinding, null, 'Review does not adopt the installation');
  await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Descargar y preparar mi equipo', exact: true }).click();
  await until(async () => { const state = await api('/creation'); if (state.preparation.status === 'error') throw new Error(state.preparation.message); return state; }, state => state.preparation.status === 'downloading' && state.preparation.received > seedBytes + 128 * 1024 && state.preparation.received < dream.bytes, 30000);
  await page.getByRole('button', { name: 'Pausar preparación', exact: true }).click();
  const paused = await until(async () => { const state = await api('/creation'); if (state.preparation.status === 'error') throw new Error(state.preparation.message); return state; }, state => state.preparation.status === 'paused');
  const pausedBytes = (await fsp.stat(partial)).size;
  assert.equal(paused.preparation.status, 'paused'); assert.equal(paused.preparation.received, pausedBytes);
  assert.ok(pausedBytes > seedBytes && pausedBytes < dream.bytes);
  record.pausedBytes = pausedBytes; record.firstServicePid = service.descriptor.pid;
  await page.screenshot({ path: path.join(dataDir, 'download-paused-ui.png'), fullPage: true });
  await saveRecord(); note(`REAL TRANSFER PAUSED: ${pausedBytes - seedBytes} new bytes received; original local prefix preserved.`);
  await stopService(); await startService(); assert.notEqual(service.descriptor.pid, record.firstServicePid);
  await authorizePage(); const restored = await api('/creation');
  assert.equal(restored.profile.id, dream.id); assert.equal(restored.preparation.status, 'paused'); assert.equal((await fsp.stat(partial)).size, pausedBytes);
  record.rangeAfterRestart = await rangeProbe(pausedBytes);
  await page.getByRole('button', { name: 'Continuar preparación', exact: true }).click();
  const progress = [];
  await until(async () => { const state = await api('/creation'); progress.push({ status: state.preparation.status, received: state.preparation.received }); if (state.preparation.status === 'error') throw new Error(state.preparation.message); assert.ok(state.preparation.received >= pausedBytes, 'The provider must not restart the file from zero'); return state; }, state => state.canCreate, 180000);
  record.resumeProgress = progress; record.finishedSha256 = await sha256(checkpoint); assert.equal(record.finishedSha256, dream.sha256);
  assert.equal((await api('/creation')).preparation.verifiedHash, dream.sha256);
  note('REAL RESUME PASS: provider returned HTTP 206 for both offsets; paused preparation survived service restart; full SHA-256 matches.');
  }
  const sdSource = path.join(sourceModels, 'checkpoints', sd15.filename), sdCopy = path.join(models, 'checkpoints', sd15.filename);
  assert.equal((await fsp.stat(sdSource)).size, sd15.bytes);
  if (!fs.existsSync(sdCopy)) await fsp.copyFile(sdSource, sdCopy, fs.constants.COPYFILE_EXCL);
  const cases = [[dream, 'balanced', 25], [dream, 'draft', 12], [dream, 'detail', 30], [sd15, 'balanced', 20], [sd15, 'draft', 12], [sd15, 'detail', 30]];
  for (const [model, suffix, steps] of cases) {
    const completed = record.jobs.find(job => job.configurationId === model.id + '-' + suffix);
    if (completed) { const saved = await api('/jobs/' + completed.id); assert.equal(saved.status, 'completed'); assert.equal(saved.configurationId, completed.configurationId); assert.equal(saved.steps, steps); note('PRESERVED REAL IMAGE: ' + saved.configurationId); continue; }
    await chooseConfiguration(model, suffix); await generate(model, suffix, steps);
  }
  const beforeRestart = await api('/jobs'); assert.equal(beforeRestart.total, 6);
  await stopService(); await startService(); await authorizePage();
  const library = await api('/jobs'); assert.equal(library.total, 6); assert.ok(library.jobs.every(job => job.status === 'completed'));
  await chooseConfiguration(dream, 'detail');
  assert.equal((await api('/creation')).recommendation.verified, true);
  const catalog = await api('/catalog'); assert.ok(catalog.models.every(item => item.status === 'prepared'));
  await page.locator('.sidebar nav').getByRole('button', { name: 'Biblioteca', exact: true }).click();
  assert.equal(await page.locator('.library-entry').count(), 6);
  await page.screenshot({ path: path.join(dataDir, 'native-library-six-real-images.png'), fullPage: true });
  assert.deepEqual(record.pageErrors || [], []);
  const originalAfter = await fsp.stat(source); assert.equal(originalAfter.size, record.original.bytes); assert.equal(originalAfter.mtimeMs, record.original.modified);
  record.reopenedLibrary = library.jobs.map(job => ({ id: job.id, profileId: job.profileId, configurationId: job.configurationId, status: job.status }));
  record.finishedAt = new Date().toISOString(); record.result = 'passed'; succeeded = true;
})().catch(async error => { record.result = 'failed'; record.error = String(error.stack || error).replace(/launch=[a-f0-9]{64}/g, 'launch=[redacted]'); console.error(record.error); process.exitCode = 1; })
.finally(async () => {
  try { await browser?.close(); } catch {}
  try { await stopService(); record.cleanup = 'owned service closed and lock released'; } catch (error) { record.cleanup = String(error); process.exitCode = 1; }
  if (succeeded && !service) { await fsp.rm(models, { recursive: true, force: true }); record.temporaryModelCopiesRemoved = true; }
  await saveRecord(); note('VALIDATION DATA: ' + dataDir);
  if (succeeded && !service) note('NATIVE CATALOG PASS: six real images, actual provider pause/resume, checksum and restart persistence; original models and user session preserved.');
});
