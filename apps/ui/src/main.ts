import { createApp } from 'vue'
import App from './App.vue'
import { setLocale } from './i18n'
import './style.css'
import './mobile.css'
import './app.css'
try {
  const theme = localStorage.getItem('veltria-theme-cache') || 'system'
  setLocale(localStorage.getItem('veltria-locale-cache') === 'en' ? 'en' : 'es')
  document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
} catch { /* presentation cache is optional */ }
createApp(App).mount('#app')
