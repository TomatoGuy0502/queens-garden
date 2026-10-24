import type zhHant from './zh-Hant'
import type { Messages } from '../types'

const en: Messages<typeof zhHant> = {
  app: {
    title: 'Queens Puzzle',
    pageTitle: 'Queens · Puzzle',
    description:
      'Queens — exactly one crown in every row, column and colored region. A logic puzzle generated on the fly.',
  },
  brand: { home: 'Queens home' },
  nav: { solo: 'Solo', coop: 'Co-op', stats: 'My stats', tutorial: 'Tutorial' },
  language: { label: 'Language' },
  home: {
    intro: 'Choose how you want to play.',
    solo: {
      title: 'Solo',
      body: 'Solve at your own pace, with replayable seeds and logical hints.',
      cta: 'Start playing',
    },
    coop: {
      title: 'Co-op',
      body: 'Invite friends to work on one board together, share your reasoning and point at cells.',
      cta: 'Create or join a room',
    },
    tutorial: {
      title: 'Tutorial',
      body: 'A few interactive exercises teach the rules, X marks and three basic deductions.',
      cta: 'Start learning',
    },
  },
}
export default en
