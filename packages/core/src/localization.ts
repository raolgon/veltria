import type { Locale } from '@veltria/contracts'
import { english } from './english'

type Values = Readonly<Record<string, string | number>>
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const templates = Object.entries(english).filter(([source]) => /\{\d+\}/.test(source)).map(([source, target]) => {
  const keys = [...source.matchAll(/\{(\d+)\}/g)].map(match => match[1])
  return { source, target, keys, pattern: new RegExp('^' + source.split(/\{\d+\}/).map(escape).join('([\\s\\S]*?)') + '$') }
})
const compositePrefixes = Object.entries(english).filter(([source]) => source.length > 40 && source.endsWith('.') && !/\{\d+\}/.test(source)).sort(([a], [b]) => b.length - a.length)
function interpolate(text: string, values: Values = {}) {
  return text.replace(/\{(\d+)\}/g, (token, key: string) => values[key] === undefined ? token : String(values[key]))
}
/** Translate product copy only. Dynamic values, prompts, names and paths stay literal. */
export function translate(source: string, locale: Locale, values?: Values): string {
  if (locale === 'es') return interpolate(source, values)
  if (Object.hasOwn(english, source)) return interpolate(english[source], values)
  if (!values) for (const template of templates) {
    const match = template.pattern.exec(source)
    if (match) {
      const captured: Record<string, string> = {}
      template.keys.forEach((key, index) => { captured[key] = match[index + 1] })
      // These product errors embed another diagnostic, rather than a name or path.
      if (template.source.startsWith('No se pudo confirmar el envío.') || template.source.startsWith('No se pudo comprobar ComfyUI (')) captured['0'] = translate(captured['0'], locale)
      return interpolate(template.target, captured)
    }
  }
  if (!values) for (const [prefix, target] of compositePrefixes) {
    if (source.startsWith(prefix + ' ')) return target + ' ' + translate(source.slice(prefix.length + 1), locale)
  }
  return interpolate(source, values)
}
