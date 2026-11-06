// Opt-in: a real public SD 1.5 LoRA download and one GPU image. Isolated from the normal library.
const fs = require('node:fs/promises'), path = require('node:path'), {spawn} = require('node:child_process'), {randomUUID} = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), {version} = require(path.join(root, 'package.json'));
const {chromium} = require(path.join(root,'node_modules/.bun/playwright-core@1.64.1/node_modules/playwright-core'));
assert.equal(process.platform,'win32'); assert.ok(process.argv[2] && path.isAbsolute(process.argv[2]));
const stamp = 'sdxl-real-' + Date.now() + '-' + randomUUID().slice(0,8);
const data = path.join(process.env.LOCALAPPDATA,'Veltria',stamp), models = process.argv[2];
const record = {kind:'real-native-sdxl',version,data,models,startedAt:new Date().toISOString()};
let child, descriptor, browser, page, launch;
const delay = ms => new Promise(r=>setTimeout(r,ms));
async function until(read, match, timeout=30000) {const end=Date.now()+timeout; do {const value=await read(); if(match(value))return value; await delay(150)}while(Date.now()<end); throw Error('Validation state timeout')}
async function start() {
  const env={...process.env,VELTRIA_DATA_DIR:data}; delete env.ELECTRON_RUN_AS_NODE;
  child=spawn(path.join(root,'build/browser',version,'veltria-web.exe'),[],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stderr.on('data',chunk=>fs.appendFile(path.join(data,'launcher.log'),chunk).catch(()=>{}));
  launch=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Launch timeout')),20000); child.on('error',reject);child.stdout.on('data',b=>{out+=b;const m=out.match(/http:\/\/127\.0\.0\.1:\d+\/#launch=[a-f0-9]{64}/); if(m){clearTimeout(timer);resolve(m[0])}})});
  const candidate=JSON.parse(await fs.readFile(path.join(data,'.service-lock/instance.json'),'utf8'));assert.equal(candidate.origin,new URL(launch).origin);descriptor=candidate;
}
async function stop(){if(!descriptor)return;const identity=await fetch(descriptor.origin+'/api/v1/identity').then(r=>r.json());assert.equal(identity.instanceId,descriptor.instanceId);await fetch(descriptor.origin+'/api/v1/control/shutdown',{method:'POST',headers:{'x-veltria-control':descriptor.controlToken},signal:AbortSignal.timeout(4000)});await until(async()=>{try{await fs.access(path.join(data,'.service-lock'));return false}catch(e){if(e.code!=='ENOENT')throw e;return true}},Boolean);descriptor=null}
async function api(route,method='GET',body){return page.evaluate(async({route,method,body})=>{const session=method==='GET'?null:await fetch('/api/v1/session').then(r=>r.json());const r=await fetch('/api/v1'+route,{method,headers:body===undefined?{}:{'content-type':'application/json','x-veltria-csrf':session.csrf},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw Error(value.message);return value},{route,method,body})}
async function authorize(){if(page)await page.close();page=await browser.newPage({viewport:{width:1363,height:900},acceptDownloads:true});await page.goto(launch);await page.getByText('Servicio local conectado',{exact:true}).waitFor()}
(async()=>{
  await fs.mkdir(data,{recursive:true});
  const mainLock=path.join(process.env.LOCALAPPDATA,'Veltria','.service-lock','instance.json');
  try {
    const main=JSON.parse(await fs.readFile(mainLock,'utf8'));
    const mainOrigin=new URL(main.origin);assert.equal(mainOrigin.protocol,'http:');assert.equal(mainOrigin.hostname,'127.0.0.1');
    const access=await fetch(main.origin+'/api/v1/control/launch',{method:'POST',headers:{'x-veltria-control':main.controlToken}}).then(r=>r.json());
    const session=await fetch(main.origin+'/api/v1/session',{method:'POST',headers:{origin:main.origin,'content-type':'application/json'},body:JSON.stringify({nonce:access.nonce})});
    const activity=await fetch(main.origin+'/api/v1/activity',{headers:{cookie:session.headers.get('set-cookie').split(';')[0]}}).then(r=>r.json());
    record.mainActivity=activity;assert.equal(activity.jobs,0);assert.equal(activity.preparing,false);
  }catch(error){if(error.code!=='ENOENT')throw error}
  await start();browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--disable-gpu']});await authorize();
  await api('/settings','PATCH',{modelsDirectory:models,locale:'es'});
  record.hardware=await api('/hardware');record.resourcesBefore=await api('/resources');
  await page.locator('.sidebar nav').getByRole('button',{name:'Modelos',exact:true}).click();
  await page.getByRole('button',{name:'Explorar todo',exact:true}).click();
  const row=page.locator('.model-row').filter({hasText:'Stable Diffusion XL Base 1.0'});
  await row.locator('button.primary-button').click();
  const dialog=page.getByRole('dialog',{name:'Preparar mi equipo',exact:true});await dialog.getByText('Usaremos lo que ya tienes',{exact:true}).waitFor({timeout:45000});
  const plan=await api('/creation/plan');assert.equal(plan.remainingBytes,0);record.plan={totalBytes:plan.totalBytes,remainingBytes:plan.remainingBytes,source:plan.source};
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Comprobar y preparar mi equipo',exact:true}).click();
  const ready=await until(async()=>{const v=await api('/creation');if(v.preparation.status==='error')throw Error(v.preparation.message);return v},v=>v.canCreate,240000);
  record.profile=ready.profile;record.preparation=ready.preparation;assert.equal(ready.profile.family,'sdxl');assert.equal(ready.preparation.verifiedHash,'31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b');
  console.log('SDXL READY: pinned checkpoint verified, existing ComfyUI launched in isolated service.');
  await page.getByLabel('Describe lo que imaginas').fill('A small stone cottage beside a river in an autumn forest, warm afternoon light, detailed illustration, balanced composition');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/jobs')&&r.request().method()==='POST');record.generationStartedAt=new Date().toISOString();await page.getByRole('button',{name:'Crear imagen',exact:true}).click();
  const job=await(await response).json();let last=0;
  record.job=await until(async()=>{const v=await api('/jobs/'+job.id);if(Date.now()-last>10000){last=Date.now();console.log('SDXL JOB: '+JSON.stringify({status:v.status,step:v.step,steps:v.steps}));await fs.writeFile(path.join(data,'current-job.json'),JSON.stringify(v))}if(['failed','cancelled','interrupted'].includes(v.status))throw Error(v.message);return v},v=>v.status==='completed',1200000);
  assert.equal(record.job.width,768);assert.equal(record.job.height,768);assert.equal(record.job.steps,20);assert.equal(record.job.cfg,7);record.generationFinishedAt=new Date().toISOString();
  const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'Guardar imagen',exact:true}).click();await(await downloaded).saveAs(path.join(data,'sdxl-real.png'));
  await page.screenshot({path:path.join(data,'sdxl-real-ui.png'),fullPage:true});
  const logs=await fs.readFile(path.join(data,'image-engine','engine.log'),'utf8');record.lowVramConfirmed=/LOW_VRAM|lowvram|low VRAM/i.test(logs);assert.equal(record.lowVramConfirmed,true);
  const state=await api('/creation');assert.equal(state.recommendation.verified,true);record.resourcesAfter=await api('/resources');
  await stop();await start();await authorize();const library=await api('/jobs');assert.equal(library.total,1);assert.equal(library.jobs[0].status,'completed');
  record.result='passed';console.log('SDXL REAL PASS: 768x768, 20 steps, CFG7, lowvram confirmed, saved PNG and restart persistence.');
})().catch(e=>{record.result='failed';record.error=String(e.stack||e).replace(/launch=[a-f0-9]{64}/g,'launch=[redacted]');console.error(record.error);process.exitCode=1}).finally(async()=>{
  try{await browser?.close();await stop();record.ownedServiceClosed=true}catch(e){record.cleanupError=String(e);process.exitCode=1}
  record.checkpointRetained=true;record.finishedAt=new Date().toISOString();await fs.writeFile(path.join(data,'validated-sdxl.json'),JSON.stringify(record,null,2));console.log('VALIDATION DATA: '+data)
});
