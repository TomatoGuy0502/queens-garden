import { useI18n } from 'vue-i18n'
import type { Message, MessageParam } from '../../shared/message'

export type Translate = (key: string, params?: Record<string, unknown>) => string

function renderUnit(t: Translate, unit: number, n: number): string {
  if (unit < n) return t('unit.row', { index: unit + 1 })
  if (unit < 2 * n) return t('unit.column', { index: unit - n + 1 })
  return t('unit.region', { letter: String.fromCharCode(65 + unit - 2 * n) })
}
function renderParam(t: Translate, value: MessageParam): string | number {
  if (typeof value !== 'object') return value
  if ('key' in value) return renderMessage(t, value)
  if ('units' in value)
    return value.units.map((unit) => renderUnit(t, unit, value.n)).join(t('unit.separator'))
  return renderUnit(t, value.unit, value.n)
}
/** Turns a message into text in the language `t` speaks. */
export function renderMessage(t: Translate, message: Message): string {
  const params = Object.fromEntries(
    Object.entries(message.params ?? {}).map(([name, value]) => [name, renderParam(t, value)]),
  )
  return t(message.key, params)
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
