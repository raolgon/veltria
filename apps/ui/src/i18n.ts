import { ref } from 'vue'
import type { Locale } from '@veltria/contracts'
import { bytes as formatBytes, translate } from '@veltria/core'

export const locale = ref<Locale>('es')
export const t = (source: string, values?: Readonly<Record<string, string | number>>) => translate(source, locale.value, values)
export const bytes = (value: number | null) => formatBytes(value, locale.value)
export const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export function setLocale(value: Locale) {
  locale.value = value
  document.documentElement.lang = value
  try { localStorage.setItem('veltria-locale-cache', value) } catch { /* optional presentation cache */ }
}
