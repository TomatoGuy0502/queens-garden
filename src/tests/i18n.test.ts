import { createI18n } from 'vue-i18n'
import { expect, it } from 'vitest'
import { renderMessage } from '../i18n/message'
import { ERROR_CODES } from '../../shared/message'
import { DEFAULT_LOCALE, LOCALES, detectLocale } from '../i18n/locales'
import en from '../i18n/messages/en'
import ja from '../i18n/messages/ja'
import zhHant from '../i18n/messages/zh-Hant'

const catalogs = { 'zh-Hant': zhHant, en, ja } as const
function flatten(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}
// Which values a sentence uses, not how often: another language may mention one twice or once.
const placeholders = (text: string) =>
  [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()
const source = new Map(flatten(zhHant))

it('picks the first supported browser language and falls back to English', () => {
  expect(detectLocale(['zh-TW'])).toBe('zh-Hant')
  expect(detectLocale(['zh-CN', 'en'])).toBe('zh-Hant')
  expect(detectLocale(['ja-JP', 'en-US'])).toBe('ja')
  expect(detectLocale(['fr-FR', 'en-GB'])).toBe('en')
  expect(detectLocale(['fr-FR', 'de'])).toBe('en')
  expect(detectLocale([])).toBe('en')
  expect(DEFAULT_LOCALE).toBe('zh-Hant')
})
it('ships a catalog for every listed locale', () => {
  expect(LOCALES.map((locale) => locale.code).sort()).toEqual(Object.keys(catalogs).sort())
})
for (const [code, catalog] of Object.entries(catalogs)) {
  it(`${code} has exactly the source keys, with the same placeholders and no blanks`, () => {
    const entries = new Map(flatten(catalog))
    expect([...entries.keys()].sort()).toEqual([...source.keys()].sort())
    for (const [key, text] of entries) {
      expect(text.trim(), key).not.toBe('')
      expect(placeholders(text), key).toEqual(placeholders(source.get(key)!))
    }
  })
}
it('describes every error code a reader can be told about, in every language', () => {
  for (const [code, catalog] of Object.entries(catalogs))
    for (const error of ERROR_CODES)
      expect((catalog.errors as Record<string, string>)[error], `${code}: ${error}`).toBeTruthy()
})
it('uses the singular and plural forms where a language has them', () => {
  const { t } = createI18n({ legacy: false, locale: 'en', messages: { en } }).global
  const render = (key: string, count: number) => renderMessage(t, { key, params: { count } })
  expect(render('check.mistakes', 1)).toBe(
    'Found 1 crown or X mark that does not match the unique solution.',
  )
  expect(render('check.mistakes', 3)).toBe(
    'Found 3 crowns or X marks that do not match the unique solution.',
  )
  expect(t('count.moves', 1)).toBe('1 move')
  expect(t('count.moves', 37)).toBe('37 moves')
  expect(t('count.hints', 0)).toBe('0 hints')
})
