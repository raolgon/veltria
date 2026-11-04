import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { development } from '@veltria/contracts'
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), plugins: [vue()],
  server: { host: '127.0.0.1', port: Number(new URL(development.uiOrigin).port), strictPort: true, allowedHosts: ['127.0.0.1'], proxy: { '/api': { target: development.serviceOrigin, changeOrigin: false } } },
  build: { outDir: 'dist', emptyOutDir: true }
})
