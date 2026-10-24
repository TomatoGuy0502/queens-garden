import { createI18n } from 'vue-i18n'
import type { Message } from '../../shared/message'
import zhHant from './messages/zh-Hant'
import { renderMessage } from './message'

const { t } = createI18n({
  legacy: false,
  locale: 'zh-Hant',
  messages: { 'zh-Hant': zhHant },
}).global
/** Renders a message in the source language without a browser, for tests that read the text. */
export const renderSource = (value: Message) => renderMessage(t, value)
