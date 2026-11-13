export function bytes(value: number | null, locale: 'es' | 'en' = 'es'): string {
  if (value === null) return locale === 'en' ? 'Unknown' : 'Desconocido'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const unit = value > 0 ? Math.min(4, Math.floor(Math.log(value) / Math.log(1024))) : 0
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1024 ** unit)} ${units[unit]}`
}
export * from './image-profile'
export * from './localization'
export * from './video-profile'
export * from './model-catalog'
export * from './qr'

