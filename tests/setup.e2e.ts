import { test, expect, _electron as electron } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
let directory: string, child: ChildProcess, origin: string
async function launchUrl() {
  const launch = await fetch(`${origin}/api/v1/control/launch`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-veltria-control': 'a'.repeat(64) }, body: '{}' }).then(response => response.json()) as {nonce: string}
  return `${origin}/#launch=${launch.nonce}`
}
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'Veltria onboarding UI fixture '))
  child = spawn('bun', ['scripts/test-creation-host.ts'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VELTRIA_TEST_DIR: directory, VELTRIA_TEST_ONBOARDING: '1' } })
  origin = await new Promise((resolve, reject) => {
    let buffer = ''; const timer = setTimeout(() => reject(new Error('fixture timeout')), 15000)
    child.once('error', reject); child.stdout?.on('data', chunk => { buffer += chunk.toString(); if (buffer.includes('\n')) { clearTimeout(timer); try { resolve(JSON.parse(buffer.split('\n')[0]).origin) } catch (cause) { reject(cause) } } })
  })
})
test.afterAll(async () => { if (child && child.exitCode === null) { const exit = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exit } if (directory) await rm(directory, { recursive: true, force: true }) })
test('bienvenida principal bloquea creación hasta preparar y conserva acceso tras recargar', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(await launchUrl())
  await expect(page.getByRole('heading', { name: 'Tu PC, lista para imaginar.' })).toBeVisible()
  await expect(page.getByLabel('Describe lo que imaginas')).toHaveCount(0)
  await expect(page.locator('.sidebar, .media-tabs, .mobile-dock')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.welcome-shell')).toBeVisible()
  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click()
  await page.getByRole('button', { name: 'Instalar y preparar mi PC', exact: true }).click()
  const proposal = page.locator('.setup-inline')
  await expect(proposal.getByText('Usaremos lo que ya tienes', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(proposal.getByRole('button', { name: 'Descargar y preparar mi equipo', exact: true })).toBeDisabled()
  await proposal.getByRole('checkbox').check()
  await proposal.locator('input[name="setup-installation"]').nth(1).check()
  await expect(proposal.getByRole('checkbox')).not.toBeChecked()
  await proposal.locator('input[name="setup-installation"]').first().check()
  await page.setViewportSize({ width: 320, height: 568 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/welcome-plan-mobile-es-dark.png', fullPage: true })
  await proposal.getByRole('checkbox').check()
  await proposal.getByRole('button', { name: 'Descargar y preparar mi equipo', exact: true }).click()
  await expect(page.getByLabel('Describe lo que imaginas')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.welcome-shell')).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Describe lo que imaginas')).toBeVisible()
  await page.getByLabel('Describe lo que imaginas').fill('An amber stone arch in a quiet desert at dawn')
  await page.getByLabel('Describe lo que imaginas').blur()
  await expect.poll(() => page.evaluate(async () => (await fetch('/api/v1/creation').then(r => r.json())).canCreate)).toBe(true)
  await expect(page.locator('.creation-mobile-action')).toContainText('Crear imagen')
  await page.locator('.creation-mobile-action').getByRole('button', { name: 'Crear imagen', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Guardar imagen', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
test('sin vínculo vuelve a bienvenida; instalación propia, inglés y móvil', async ({ page }) => {
  await page.goto(await launchUrl())
  await expect(page.getByText('Servicio local conectado')).toBeVisible()
  await page.evaluate(async () => {
    const session = await fetch('/api/v1/session').then(r => r.json())
    const response = await fetch('/api/v1/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-veltria-csrf': session.csrf }, body: JSON.stringify({ engineBinding: null, locale: 'en', theme: 'light' }) })
    if (!response.ok) throw new Error('fixture reset failed')
  })
  await expect(page.getByRole('heading', { name: 'Your PC, ready to imagine.' })).toBeVisible()
  await expect(page.getByLabel('Describe what you imagine')).toHaveCount(0)
  await page.getByRole('button', { name: 'Install and prepare my PC', exact: true }).click()
  const proposal = page.locator('.setup-inline')
  await proposal.getByRole('button', { name: 'Prepare a separate installation', exact: true }).click()
  await expect(proposal.getByText('Pending environment download', { exact: true })).toBeVisible()
  await expect(proposal.getByRole('checkbox')).toBeEnabled()
  await expect(proposal.getByRole('button', { name: 'Install and prepare my computer', exact: true })).toBeDisabled()
  await page.setViewportSize({ width: 320, height: 568 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/welcome-plan-mobile-en-light.png', fullPage: true })
  await page.getByRole('button', { name: 'Choose a different model', exact: true }).click()
  await expect(proposal).toHaveCount(0)
  await expect(page.getByLabel('Describe what you imagine')).toHaveCount(0)
})
test('storage notices distinguish warning and blocker, reset consent and change the models folder', async ({ page }) => {
  let blocked = false
  await page.route('**/api/v1/setup/managed/plan', async route => {
    const response = await route.fetch(), plan = await response.json()
    const issue = { code: blocked ? 'disk-full' : 'low-space', severity: blocked ? 'error' : 'warning', target: 'models', path: '/fixture/models', message: blocked ? 'No hay espacio suficiente para completar la preparación y conservar sus archivos temporales. Libera espacio o elige otra carpeta.' : 'Quedará poco espacio libre después de preparar. Libera espacio o elige otra carpeta para tener más margen.', requiredBytes: 1024 ** 3, availableBytes: blocked ? 1 : 1024 ** 3 + 1 }
    await route.fulfill({ response, json: { ...plan, storageIssues: [issue], canPrepare: !blocked, blockers: blocked ? [issue.message] : [] } })
  })
  await page.goto(await launchUrl())
  await expect(page.getByRole('heading', { name: 'Your PC, ready to imagine.' })).toBeVisible()
  await page.getByRole('button', { name: 'Install and prepare my PC', exact: true }).click()
  await page.getByRole('button', { name: 'Prepare a separate installation', exact: true }).click()
  const setup = page.locator('.managed-setup')
  await expect(setup.getByText('Storage is running low', { exact: true })).toBeVisible()
  await setup.getByRole('checkbox').check()
  await expect(setup.getByRole('button', { name: 'Install and prepare my computer', exact: true })).toBeEnabled()
  blocked = true
  await setup.getByRole('button', { name: 'Check again', exact: true }).click()
  await expect(setup.getByRole('alert')).toContainText('More free space is needed')
  await expect(setup.getByRole('checkbox')).not.toBeChecked()
  await expect(setup.getByRole('checkbox')).toBeDisabled()
  await setup.getByRole('button', { name: 'Change folder', exact: true }).click()
  await setup.getByLabel('Models folder on the service computer').fill(join(directory,'new-model-location'))
  blocked = false
  await setup.getByRole('button', { name: 'Use folder and review plan', exact: true }).click()
  await expect(setup.getByRole('checkbox')).toBeEnabled()
  await expect(setup.getByRole('checkbox')).not.toBeChecked()
  await expect.poll(() => page.evaluate(async () => (await fetch('/api/v1/settings').then(r => r.json())).modelsDirectory)).toBe(join(directory,'new-model-location'))
  await page.setViewportSize({width:320,height:568})
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Electron: selector nativo de carpeta mediante IPC limitado, con renderer aislado', async () => {
  test.skip(!!process.env.VELTRIA_SKIP_ELECTRON, 'Electron unavailable')
  const executable = process.env.VELTRIA_ELECTRON_EXECUTABLE
  const app = await electron.launch({ chromiumSandbox: true, ...(executable ? { executablePath: executable } : {}), args: executable ? [] : [resolve('apps/desktop/dist/main.cjs')], env: { ...process.env, VELTRIA_DATA_DIR: directory } })
  try {
    const page = await app.firstWindow()
    await expect(page.getByText('Local service connected')).toBeVisible()
    expect(await page.evaluate(() => typeof (window as any).veltriaDesktop?.chooseEngineDirectory)).toBe('function')
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined')
    await app.evaluate(({ dialog }, directory) => {
      ;(globalThis as any).folderCalls = 0
      ;(dialog as any).showOpenDialog = async () => { (globalThis as any).folderCalls++; return { canceled: false, filePaths: [directory] } }
    }, join(directory, 'existing engine fixture'))
    await page.getByRole('button', { name: 'Install and prepare my PC', exact: true }).click()
    const dialog = page.locator('.setup-inline')
    await expect(dialog.getByText('We will use what you already have', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Search another folder', exact: true }).click()
    await expect.poll(() => app.evaluate(() => (globalThis as any).folderCalls)).toBe(1)
    await expect(dialog.getByRole('button', { name: 'Check and prepare my computer', exact: true })).toBeVisible()
    await dialog.getByText('View installation, location and changes', { exact: true }).click()
    await expect(dialog.locator('.setup-technical')).toContainText(join(directory, 'existing engine fixture'))

  } finally { await app.close() }
})
