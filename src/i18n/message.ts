import { useI18n } from 'vue-i18n'
import type { Message, MessageParam } from '../../shared/message'

export type Translate = (key: string, params?: Record<string, unknown>, plural?: number) => string

function renderUnit(t: Translate, unit: number, n: number): string {
  if (unit < n) return t('unit.row', { index: unit + 1 })
  if (unit < 2 * n) return t('unit.column', { index: unit - n + 1 })
  return t('unit.region', { letter: String.fromCharCode(65 + unit - 2 * n) })
}
function renderUnit3(t: Translate, unit: number, n: number): string {
  const family = Math.floor(unit / (n * n)),
    major = Math.floor((unit % (n * n)) / n) + 1,
    minor = (unit % n) + 1
  if (family === 0) return t('unit3.layerRow', { layer: major, index: minor })
  if (family === 1) return t('unit3.layerCol', { layer: major, index: minor })
  if (family === 2) return t('unit3.pillar', { row: major, col: minor })
  return t('unit3.region', { layer: major, letter: String.fromCharCode(64 + minor) })
}
function renderParam(t: Translate, value: MessageParam): string | number {
  if (typeof value !== 'object') return value
  if ('key' in value) return renderMessage(t, value)
  if ('units3' in value)
    return value.units3.map((unit) => renderUnit3(t, unit, value.n)).join(t('unit.separator'))
  if ('unit3' in value) return renderUnit3(t, value.unit3, value.n)
  if ('units' in value)
    return value.units.map((unit) => renderUnit(t, unit, value.n)).join(t('unit.separator'))
  return renderUnit(t, value.unit, value.n)
}
/** Turns a message into text in the language `t` speaks. */
export function renderMessage(t: Translate, message: Message): string {
  const params = Object.fromEntries(
    Object.entries(message.params ?? {}).map(([name, value]) => [name, renderParam(t, value)]),
  )
  // A `count` parameter also picks the singular or plural form where a language has them.
  return t(message.key, params, typeof params.count === 'number' ? params.count : undefined)
}
/**
 * Renders what a component was given: null shows nothing, and plain text (a notice stored in a
 * room before notices became messages) is shown as it is.
 */
export function renderOptional(t: Translate, value: Message | string | null | undefined): string {
  if (!value) return ''
  return typeof value === 'string' ? value : renderMessage(t, value)
}
/** For components: renders messages in the current interface language. */
export function useMessage() {
  const { t } = useI18n()
  return (value: Message | string | null | undefined) => renderOptional(t, value)
}
