import { mkdir, cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
if (Bun.version !== '1.4.4') throw new Error('Este proyecto requiere Bun 1.4.4.')
const target = process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1] || `bun-${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}${process.arch === 'x64' ? '-baseline' : ''}`
async function run(args: string[]) {
  const p = Bun.spawn([process.execPath, ...args], { cwd: resolve('.'), stdout: 'inherit', stderr: 'inherit' })
  if (await p.exited !== 0) throw new Error(`Falló ${args[0]}`)
}
await run([resolve('apps/ui/node_modules/vite/bin/vite.js'), 'build', '--config', 'apps/ui/vite.config.ts'])
await mkdir('build/service', { recursive: true })
await run(['build', '--compile', `--target=${target}`, './apps/local-service/src/index.ts', '--outfile', `build/service/veltria-service${target.includes('windows') ? '.exe' : ''}`])
const extension = target.includes('windows') ? '.exe' : ''
const browserDirectory = 'build/browser/0.5.0'
await mkdir(`${browserDirectory}/resources/service`, { recursive: true })
await run(['build', '--compile', `--target=${target}`, './scripts/web-launcher.ts', '--outfile', `${browserDirectory}/veltria-web${extension}`])
await cp(`build/service/veltria-service${extension}`, `${browserDirectory}/resources/service/veltria-service${extension}`)
await cp('apps/ui/dist', `${browserDirectory}/resources/ui`, { recursive: true })
await build({ entryPoints: ['apps/desktop/src/main.ts'], outfile: 'apps/desktop/dist/main.cjs', bundle: true, platform: 'node', target: 'node24', format: 'cjs', external: ['electron'] })
await build({ entryPoints: ['apps/desktop/src/preload.ts'], outfile: 'apps/desktop/dist/preload.cjs', bundle: true, platform: 'node', target: 'node24', format: 'cjs', external: ['electron'] })
console.log(`UI, Electron main y auxiliar ${target} compilados. Compilar no certifica otra plataforma.`)
