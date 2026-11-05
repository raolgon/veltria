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
test('primera preparación: detección, plan y consentimiento sin rutas de Python, conserva la idea y crea', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(await launchUrl())
  await expect(page.getByText('Servicio local conectado')).toBeVisible()
  await page.locator('.sidebar nav').getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await page.locator('.sidebar nav').getByRole('button', { name: 'Crear', exact: true }).click()
  const prompt = 'My first idea stays exactly as written 日本語'
  await page.getByLabel('Describe lo que imaginas').fill(prompt)
  await page.getByRole('button', { name: 'Vertical', exact: true }).click()
  await page.getByRole('button', { name: 'Preparar mi equipo', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Preparar mi equipo', exact: true })
  await expect(dialog.getByText('Usaremos lo que ya tienes', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Descargar y preparar mi equipo', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('radio').nth(1).check()
  await expect(dialog.getByRole('checkbox')).not.toBeChecked()
  await dialog.getByRole('radio').first().check()
  await expect(dialog.getByText('Usaremos lo que ya tienes', { exact: true })).toBeVisible()
  expect(await page.evaluate(async () => (await fetch('/api/v1/settings').then(r => r.json())).engineBinding)).toBeNull()
  await page.screenshot({ path: 'test-results/setup-proposal-desktop-es-dark.png' })
  await page.setViewportSize({ width: 320, height: 568 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/setup-proposal-mobile-es-dark.png' })
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Descargar y preparar mi equipo', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('.creation-mobile-action').getByRole('button', { name: 'Crear imagen', exact: true })).toBeEnabled({ timeout: 15000 })
  await expect(page.getByLabel('Describe lo que imaginas')).toHaveValue(prompt)
  await expect(page.getByRole('button', { name: 'Vertical', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.creation-mobile-action').getByRole('button', { name: 'Crear imagen', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Guardar imagen', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
test('sin instalación: recuperación con una carpeta, inglés, móvil y vuelta sin perder la descripción', async ({ page }) => {
  await page.goto(await launchUrl())
  await expect(page.getByText('Servicio local conectado')).toBeVisible()
  await page.evaluate(async () => {
    const session = await fetch('/api/v1/session').then(r => r.json())
    const response = await fetch('/api/v1/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-veltria-csrf': session.csrf }, body: JSON.stringify({ engineBinding: null, locale: 'en', theme: 'light' }) })
    if (!response.ok) throw new Error('fixture reset failed')
  })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByLabel('Describe what you imagine').fill('Keep this description during search')
  await page.getByRole('button', { name: 'Prepare my computer', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('We will use what you already have', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Search another folder', exact: true }).click()
  await dialog.getByLabel('Installation folder on the computer running Veltria').fill(join(directory, 'missing'))
  await dialog.getByRole('button', { name: 'Search this folder', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Choose where your installation is', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 568 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/setup-empty-mobile-en-light.png' })
  await dialog.getByRole('button', { name: 'Search another folder', exact: true }).click()
  await dialog.getByLabel('Installation folder on the computer running Veltria').fill(join(directory, 'existing engine fixture'))
  await dialog.getByRole('button', { name: 'Search this folder', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Check and prepare my computer', exact: true })).toBeDisabled()
  await page.setViewportSize({ width: 1363, height: 900 })
  await page.screenshot({ path: 'test-results/setup-proposal-desktop-en-light.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Describe what you imagine')).toHaveValue('Keep this description during search')
  expect(await page.evaluate(async () => (await fetch('/api/v1/settings').then(r => r.json())).engineBinding)).toBeNull()
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
    await page.getByRole('button', { name: 'Prepare my computer', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('We will use what you already have', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Search another folder', exact: true }).click()
    await expect.poll(() => app.evaluate(() => (globalThis as any).folderCalls)).toBe(1)
    await expect(dialog.getByRole('button', { name: 'Check and prepare my computer', exact: true })).toBeVisible()
    await dialog.getByText('View installation, location and changes', { exact: true }).click()
    await expect(dialog.locator('.setup-technical')).toContainText(join(directory, 'existing engine fixture'))
    await dialog.getByRole('button', { name: 'Close computer preparation', exact: true }).click()
  } finally { await app.close() }
})
