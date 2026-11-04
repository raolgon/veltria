import electron from 'electron'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, [fileURLToPath(new URL('../apps/desktop/dist/main.cjs', import.meta.url))], { cwd: root, stdio: 'inherit', shell: false, env })
child.on('exit', code => process.exit(code ?? 1))
child.on('error', error => { console.error(error.message); process.exit(1) })
