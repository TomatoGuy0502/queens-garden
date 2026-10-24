import type zhHant from './zh-Hant'
import type { Messages } from '../types'

const ja: Messages<typeof zhHant> = {
  app: {
    title: 'Queens パズル',
    pageTitle: 'Queens · パズル',
    description:
      'Queens — 各行・各列・各色の領域に、クラウンをちょうど 1 つずつ。その場で生成されるロジックパズル。',
  },
  brand: { home: 'Queens ホーム' },
  nav: { solo: 'ひとりで', coop: 'みんなで', stats: '成績', tutorial: 'チュートリアル' },
  language: { label: '言語' },
  home: {
    intro: '遊び方を選んでください。',
    solo: {
      title: 'ひとりで遊ぶ',
      body: '自分のペースで解けます。シード指定での再現と、論理的なヒントに対応。',
      cta: '遊ぶ',
    },
    coop: {
      title: 'みんなで協力',
      body: '友だちを招待して、同じ盤面を一緒に操作。推理の共有やマスの指示もできます。',
      cta: 'ルームを作成・参加',
    },
    tutorial: {
      title: 'チュートリアル',
      body: 'いくつかの練習で、ルール、X マーク、3 つの基本的な推理を学びます。',
      cta: '学び始める',
    },
  },
}
export default ja
