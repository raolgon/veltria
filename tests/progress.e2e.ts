import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
let directory: string, child: ChildProcess, url: string
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'Veltria streamed progress '))
  child = spawn('bun', ['scripts/test-progress-host.ts'], { shell: false, stdio: ['ignore','pipe','pipe'], env: { ...process.env, VELTRIA_TEST_DIR: directory } })
  url = await new Promise((resolve, reject) => {
    let buffer = ''; const timer = setTimeout(()=>reject(new Error('fixture timeout')),15000)
    child.once('error',reject); child.stdout?.on('data', chunk => { buffer += chunk.toString(); if(buffer.includes('\n')) { clearTimeout(timer); const ready=JSON.parse(buffer.split('\n')[0]); resolve(ready.origin+'/#launch='+ready.nonce) } })
  })
})
test.afterAll(async () => { if(child && child.exitCode === null) { const stopped=new Promise(resolve=>child.once('exit',resolve)); child.kill('SIGTERM'); await stopped }; if(directory) await rm(directory,{recursive:true,force:true}) })
test('avance real de bytes en entorno y modelo, actividad de instalación y acceso final', async ({ page }) => {
  await page.goto(url)
  await page.getByRole('button',{name:'Instalar y preparar mi PC',exact:true}).click()
  await page.locator('.managed-setup').getByRole('checkbox').check()
  await page.getByRole('button',{name:'Instalar y preparar mi equipo',exact:true}).click()
  const environment=page.getByRole('progressbar',{name:'Descarga del entorno',exact:true})
  await expect(environment).toBeVisible()
  const first=await environment.evaluate((e:HTMLProgressElement)=>e.value)
  await expect.poll(()=>environment.evaluate((e:HTMLProgressElement)=>e.value)).toBeGreaterThan(first)
  await expect(page.locator('.progress-percentage')).toContainText('%')
  const installing=page.getByRole('progressbar',{name:'Instalando el entorno',exact:true})
  await expect(installing).toBeVisible({timeout:15000})
  await expect(installing).not.toHaveAttribute('aria-valuenow')
  const marker=installing.locator('span'), position=await marker.evaluate(e=>getComputedStyle(e).transform)
  await expect.poll(()=>marker.evaluate(e=>getComputedStyle(e).transform)).not.toBe(position)
  const model=page.getByRole('progressbar',{name:'Descarga del modelo',exact:true})
  await expect(model).toBeVisible()
  const modelFirst=await model.evaluate((e:HTMLProgressElement)=>e.value)
  await expect.poll(()=>model.evaluate((e:HTMLProgressElement)=>e.value)).toBeGreaterThan(modelFirst)
  expect(await model.evaluate((e:HTMLProgressElement)=>e.max)).toBe(512*1024)
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'build/lab/model-progress-mobile.png',fullPage:true})
  await expect(page.getByLabel('Describe lo que imaginas')).toBeVisible({timeout:15000})
})
