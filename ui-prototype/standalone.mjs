import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
let html = readFileSync('dist/index.html', 'utf8')
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, file) => '<script type="module">' + readFileSync(resolve('dist', file), 'utf8').replaceAll('</script', '<\\/script') + '</script>')
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, file) => '<style>' + readFileSync(resolve('dist', file), 'utf8') + '</style>')
writeFileSync('veltria.html', html)
console.log('Offline preview: veltria.html')
