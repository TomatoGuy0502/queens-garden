import { test, expect, type Page } from '@playwright/test'
import { dailyConfig } from '../src/queens/daily'
import { solve } from '../src/queens/solver'
import zhHant from '../src/i18n/messages/zh-Hant'

test.use({ timezoneId: 'Asia/Taipei' })
const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

const cell = (page: Page, i: number) => page.locator(`[data-index="${i}"]`)
// One click marks a cell with an X and a second click turns it into a queen.
async function queen(page: Page, i: number) {
  await cell(page, i).click()
  await cell(page, i).click()
}
async function solvePuzzle(page: Page) {
  const regions = await page
    .getByRole('gridcell')
    .evaluateAll((elements) => elements.map((el) => Number(el.getAttribute('data-region'))))
  const n = Math.sqrt(regions.length)
  const board = Array.from({ length: n }, (_, r) => regions.slice(r * n, (r + 1) * n))
  const result = solve(board)
  expect(result.solutionCount).toBe(1)
  for (const [r, c] of result.solutions[0].entries()) await queen(page, r * n + c)
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
}
const day = (page: Page, key: string) => page.clock.setFixedTime(new Date(`${key}T10:00:00+08:00`))
async function playToday(page: Page, key: string) {
  const { size, difficulty } = dailyConfig(key)
  await page.getByRole('link', { name: /開始今日挑戰|再玩一次/ }).click()
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  await expect(page.locator('.daily-badge')).toHaveText('每日挑戰')
  await expect(page.locator('.puzzle-meta')).toContainText(zhHant.difficulty[difficulty])
  await expect(page).toHaveURL(new RegExp(`daily=${key}`))
  await solvePuzzle(page)
}

test('everyone gets the same daily board, and finishing it builds a streak across days', async ({
  page,
}) => {
  const first = '2026-10-27',
    second = '2026-10-28'
  await day(page, first)
  await page.goto('/')
  const config = dailyConfig(first)
  await expect(page.locator('.daily')).toContainText(first)
  await expect(page.locator('.daily')).toContainText(
    `${config.size} × ${config.size} · ${zhHant.difficulty[config.difficulty]}`,
  )
  await expect(page.locator('.daily')).toContainText('今天還沒完成')
  await playToday(page, first)
  const firstRegions = await page
    .getByRole('gridcell')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-region')))
  await expect(page.getByText('每日挑戰完成！連續 1 天')).toBeVisible()
  await page.goto('/')
  await expect(page.locator('.daily')).toContainText('已完成')
  await expect(page.locator('.daily')).toContainText('連續 1 天')
  // A different visitor on the same day opens the very same board.
  const other = await page
    .context()
    .browser()!
    .newContext({ timezoneId: 'Asia/Taipei', locale: 'zh-TW' })
  const otherPage = await other.newPage()
  await day(otherPage, first)
  await otherPage.goto('/')
  await otherPage.getByRole('link', { name: '開始今日挑戰' }).click()
  await expect(otherPage.getByRole('gridcell')).toHaveCount(config.size ** 2, { timeout: 60000 })
  expect(
    await otherPage
      .getByRole('gridcell')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-region'))),
  ).toEqual(firstRegions)
  await other.close()
  await day(page, second)
  await page.goto('/')
  await expect(page.locator('.daily')).toContainText('今天還沒完成')
  await expect(page.locator('.daily')).toContainText('連續 1 天')
  await playToday(page, second)
  await expect(page.getByText('每日挑戰完成！連續 2 天')).toBeVisible()
})
test('a daily link only counts for today and replaying the shared link keeps the badge', async ({
  page,
}) => {
  const today = '2026-10-27'
  await day(page, today)
  await page.goto('/?daily=today')
  const { size } = dailyConfig(today)
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  const url = page.url()
  await page.goto(url)
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  await expect(page.locator('.daily-badge')).toBeVisible()
  await day(page, '2026-10-28')
  await page.goto(url)
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  await expect(page.locator('.daily-badge')).toHaveCount(0)
  await page.goto('/solo?size=6&difficulty=easy&seed=42&daily=2026-10-28')
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 60000 })
  await expect(page.locator('.daily-badge')).toHaveCount(0)
})
test('the daily challenge can be restarted from the game page', async ({ page }) => {
  await day(page, '2026-10-27')
  await page.goto('/solo?size=6&difficulty=easy&seed=42')
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
  await expect(page.locator('.daily-badge')).toHaveCount(0)
  await page.getByRole('button', { name: '開始今日挑戰' }).click()
  const { size } = dailyConfig('2026-10-27')
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  await expect(page.locator('.daily-badge')).toBeVisible()
})
test('the daily page hides game settings and free play brings them back', async ({ page }) => {
  await day(page, '2026-10-27')
  await page.goto('/solo?size=6&difficulty=easy&seed=42')
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
  await expect(page.getByRole('heading', { name: '遊戲設定' })).toBeVisible()
  await page.getByRole('button', { name: '開始今日挑戰' }).click()
  const { size } = dailyConfig('2026-10-27')
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  await expect(page.getByRole('heading', { name: '遊戲設定' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '開始新遊戲' })).toHaveCount(0)
  // Already inside the challenge, so the side panel has no daily card; it only offers the way out.
  await expect(page.locator('.daily')).toHaveCount(0)
  await expect(page.getByText('所有人拿到同一題')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '離開每日挑戰，自由遊玩' })).toBeVisible()
  // Opening the daily link directly shows the same focused page.
  await page.goto('/?daily=today')
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  await expect(page.getByRole('heading', { name: '遊戲設定' })).toHaveCount(0)
  await solvePuzzle(page)
  await expect(page.getByRole('button', { name: '自由遊玩 →' })).toBeFocused()
  await page.getByRole('button', { name: '自由遊玩 →' }).click()
  await expect(page.getByRole('heading', { name: '遊戲設定' })).toBeVisible()
  await expect(page.locator('.daily')).toContainText('已完成')
  await expect(page.locator('.daily-badge')).toHaveCount(0)
  await expect(page.locator('[data-state="empty"]')).toHaveCount(size * size)
  await page
    .getByRole('button', { name: '開始今日挑戰' })
    .or(page.getByRole('button', { name: '再玩一次' }))
    .click()
  await expect(page.getByRole('heading', { name: '遊戲設定' })).toHaveCount(0)
  await page.getByRole('button', { name: '離開每日挑戰，自由遊玩' }).click()
  await expect(page.getByRole('heading', { name: '遊戲設定' })).toBeVisible()
})
