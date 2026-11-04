import { spawn } from 'node:child_process'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium, expect } from '@playwright/test'
const directory = await mkdtemp(join(tmpdir(), 'Veltria Vite smoke '))
const child = spawn('bun', ['scripts/dev.ts'], { shell: false, env: { ...process.env, VELTRIA_DATA_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'] })
let browser
try {
  const url = await new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error('Timeout de desarrollo')), 20000)
    child.on('error', reject)
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Desarrollo termino: ${code}`)) })
    child.stdout.on('data', chunk => {
      buffer += chunk.toString()
      const match = buffer.match(/http:\/\/127\.0\.0\.1:43120\/#launch=[a-f0-9]{64}/)
      if (match) { clearTimeout(timer); resolve(match[0]) }
    })
    child.stderr.on('data', () => {})
  })
  await expect.poll(async () => fetch('http://127.0.0.1:43120').then(r => r.status).catch(() => 0)).toBe(200)
  browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(url)
  await expect(page.getByText('Servicio local conectado')).toBeVisible()
  await page.locator('.sidebar nav').getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  await expect(page.getByText('Apariencia guardada en este equipo.')).toBeVisible()
  await browser.close(); browser = undefined
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill('SIGTERM'); await exited
  await expect.poll(async () => access(join(directory, '.service-lock')).then(() => true).catch(() => false)).toBe(false)
  console.log('Vite/Bun fuente: proxy explícito, sesión, CSRF, UI, preferencia SQLite y cierre OK.')
} finally {
  await browser?.close()
  if (child.exitCode === null) {
    const closed = new Promise(resolve => child.once('exit', resolve))
    child.kill('SIGTERM')
    await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 8000))])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  await rm(directory, { recursive: true, force: true })
}
