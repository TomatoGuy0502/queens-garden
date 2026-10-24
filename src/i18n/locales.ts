export const LOCALES = [
  { code: 'zh-Hant', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
] as const
export type Locale = (typeof LOCALES)[number]['code']
export const DEFAULT_LOCALE: Locale = 'zh-Hant'
/** Shown when nothing in the browser's language list is supported. */
export const FALLBACK_LOCALE: Locale = 'en'

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.some((locale) => locale.code === value)

/** The first supported language in the browser's preference order, e.g. zh-TW → zh-Hant. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (base === 'zh') return 'zh-Hant'
    if (base === 'ja') return 'ja'
    if (base === 'en') return 'en'
  }
  return FALLBACK_LOCALE
}
