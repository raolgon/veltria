// Opt-in: a real public SD 1.5 LoRA download and one GPU image. Isolated from the normal library.
const fs = require('node:fs/promises'), path = require('node:path'), {spawn} = require('node:child_process'), {randomUUID} = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), {version} = require(path.join(root, 'package.json'));
const {chromium} = require(path.join(root,'node_modules/.bun/playwright-core@1.64.1/node_modules/playwright-core'));
assert.equal(process.platform,'win32'); assert.ok(process.argv[2] && path.isAbsolute(process.argv[2]));
const stamp = 'discovery-real-' + Date.now() + '-' + randomUUID().slice(0,8);
const data = path.join(process.env.LOCALAPPDATA,'Veltria',stamp), models = path.join(path.dirname(process.argv[2]),'validation',stamp,'models');
const record = {kind:'real-native-discovery',version,data,models,startedAt:new Date().toISOString()};
let child, descriptor, browser, page, launch;
const delay = ms => new Promise(r=>setTimeout(r,ms));
async function until(read, match, timeout=30000) {const end=Date.now()+timeout; do {const value=await read(); if(match(value))return value; await delay(150)}while(Date.now()<end); throw Error('Validation state timeout')}
async function start() {
  const env={...process.env,VELTRIA_DATA_DIR:data}; delete env.ELECTRON_RUN_AS_NODE;
  child=spawn(path.join(root,'build/browser',version,'veltria-web.exe'),[],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stderr.on('data',chunk=>fs.appendFile(path.join(data,'launcher.log'),chunk).catch(()=>{}));
  launch=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Launch timeout')),20000); child.on('error',reject);child.stdout.on('data',b=>{out+=b;const m=out.match(/http:\/\/127\.0\.0\.1:\d+\/#launch=[a-f0-9]{64}/); if(m){clearTimeout(timer);resolve(m[0])}})});
  descriptor=JSON.parse(await fs.readFile(path.join(data,'.service-lock/instance.json'),'utf8'));
}
async function stop(){if(!descriptor)return;const identity=await fetch(descriptor.origin+'/api/v1/identity').then(r=>r.json());assert.equal(identity.instanceId,descriptor.instanceId);await fetch(descriptor.origin+'/api/v1/control/shutdown',{method:'POST',headers:{'x-veltria-control':descriptor.controlToken},signal:AbortSignal.timeout(4000)});await until(async()=>{try{await fs.access(path.join(data,'.service-lock'));return false}catch(e){if(e.code!=='ENOENT')throw e;return true}},Boolean);descriptor=null}
async function api(route,method='GET',body){return page.evaluate(async({route,method,body})=>{const session=method==='GET'?null:await fetch('/api/v1/session').then(r=>r.json());const r=await fetch('/api/v1'+route,{method,headers:body===undefined?{}:{'content-type':'application/json','x-veltria-csrf':session.csrf},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw Error(value.message);return value},{route,method,body})}
async function authorize(){if(page)await page.close();page=await browser.newPage({viewport:{width:1363,height:900},acceptDownloads:true});await page.goto(launch);await page.getByText('Servicio local conectado',{exact:true}).waitFor()}
(async()=>{
  await fs.mkdir(data,{recursive:true}); await fs.mkdir(path.join(models,'checkpoints'),{recursive:true});
  const base='veltria-sd15-e9476a13.safetensors';
  await fs.copyFile(path.join(process.argv[2],'checkpoints',base),path.join(models,'checkpoints',base),require('node:fs').constants.COPYFILE_EXCL);
  await start();browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--disable-gpu']});await authorize();
  await api('/settings','PATCH',{modelsDirectory:models,locale:'es'});
  await page.locator('.sidebar nav').getByRole('button',{name:'Modelos',exact:true}).click();
  await page.locator('#model-search').fill('sd15');await page.locator('.discovery-search summary').click();await page.locator('#model-kind').selectOption('lora');
  await page.getByRole('button',{name:'Buscar en Internet',exact:true}).click();
  const row=page.locator('.discovery-results .model-row').filter({hasText:'sd15-storybook-anime-lora'});await row.waitFor({timeout:35000});
  await page.screenshot({path:path.join(data,'real-search.png'),fullPage:true});
  await row.getByRole('button',{name:'Preparar y usar',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Preparar mi equipo',exact:true});await dialog.getByText('Usaremos lo que ya tienes',{exact:true}).waitFor({timeout:45000});
  const plan=await api('/creation/plan');record.plan={totalBytes:plan.totalBytes,remainingBytes:plan.remainingBytes,source:plan.source};
  assert.equal(plan.remainingBytes,37869632); // Existing base is reused; no second checkpoint download.
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Descargar y preparar mi equipo',exact:true}).click();
  const ready=await until(async()=>{const v=await api('/creation');if(v.preparation.status==='error')throw Error(v.preparation.message);return v},v=>v.canCreate,180000);
  record.preparation=ready.preparation;record.profile=ready.profile;
  assert.equal(ready.profile.adaptation.strength,0.7);assert.equal(ready.preparation.verifiedHash,'0304bb42819790cf63f4125ac70cee60fda682cc5aa4bfb512bb9e3b1746e9b0');
  await page.getByLabel('Describe lo que imaginas').fill('A small cottage in an autumn forest, storybook illustration, warm light');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/jobs')&&r.request().method()==='POST');await page.getByRole('button',{name:'Crear imagen',exact:true}).click();
  const job=await(await response).json();record.job=await until(async()=>{const v=await api('/jobs/'+job.id);if(['failed','cancelled','interrupted'].includes(v.status))throw Error(v.message);return v},v=>v.status==='completed',240000);
  assert.equal(record.job.width,512);assert.equal(record.job.height,512);
  const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'Guardar imagen',exact:true}).click();await(await downloaded).saveAs(path.join(data,'real-lora.png'));
  await page.screenshot({path:path.join(data,'real-lora-ui.png'),fullPage:true});
  await stop();await start();await authorize();const library=await api('/jobs');assert.equal(library.total,1);assert.equal(library.jobs[0].status,'completed');
  record.result='passed';console.log('REAL DISCOVERY PASS: public search, LoRA header, 37,869,632-byte download, SHA-256, existing base, native UI GPU image, saved result and restart persistence.');
})().catch(e=>{record.result='failed';record.error=String(e.stack||e).replace(/launch=[a-f0-9]{64}/g,'launch=[redacted]');console.error(record.error);process.exitCode=1}).finally(async()=>{
  try{await browser?.close();await stop();record.ownedServiceClosed=true}catch(e){record.cleanupError=String(e);process.exitCode=1}
  if(record.result==='passed'&&!descriptor){await fs.rm(models,{recursive:true,force:true});record.temporaryModelCopiesRemoved=true}
  record.finishedAt=new Date().toISOString();await fs.writeFile(path.join(data,'validated-discovery.json'),JSON.stringify(record,null,2));console.log('VALIDATION DATA: '+data)
});
