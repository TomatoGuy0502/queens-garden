import { test, expect, type Page } from '@playwright/test'
import { dailyConfig } from '../src/queens/daily'
import { solve } from '../src/queens/solver'
import { GENERATOR_VERSION } from '../src/queens/version'

test.use({ timezoneId: 'Asia/Taipei' })
const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

const KEY = 'queens:solo-progress:v1'
const link = (seed: number) => `/solo?size=6&difficulty=easy&seed=${seed}&v=${GENERATOR_VERSION}`
const cell = (page: Page, i: number) => page.locator(`[data-index="${i}"]`)
// One click marks a cell with an X and a second click turns it into a queen.
async function queen(page: Page, i: number) {
  await cell(page, i).click()
  await cell(page, i).click()
}
const saved = (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as { seed: number; moves: number; cells: string }) : null
  }, KEY)
async function open(page: Page, seed = 42) {
  await page.goto(link(seed))
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
}
/** One queen and one X: three edits in total. */
async function play(page: Page) {
  await queen(page, 0)
  await cell(page, 1).click()
  await expect.poll(async () => (await saved(page))?.moves).toBe(3)
}
const prompt = (page: Page) => page.getByRole('group', { name: '繼續上一局？' })

test('an unfinished game is offered back after leaving and keeps its board, history and clock', async ({
  page,
}) => {
  await open(page)
  await page.waitForTimeout(1200)
  await play(page)
  const before = await page.locator('.timer > span').innerText()
  await page.goto('/solo')
  await expect(prompt(page)).toBeVisible()
  await expect(prompt(page)).toContainText('6 × 6')
  await expect(prompt(page)).toContainText('3 次操作')
  await expect(page.getByRole('grid')).toHaveCount(0)
  await prompt(page).getByRole('button', { name: '繼續這一局' }).click()
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
  await expect(page).toHaveURL(/seed=42/)
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
  await expect(cell(page, 1)).toHaveAttribute('data-state', 'marked')
  await expect(page.locator('.timer > span')).not.toHaveText('00:00')
  expect((await page.locator('.timer > span').innerText()) >= before).toBe(true)
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await expect(cell(page, 1)).toHaveAttribute('data-state', 'empty')
})
test('opening the link of the same puzzle resumes it without asking', async ({ page }) => {
  await open(page)
  await play(page)
  await page.goto(link(42))
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
  await expect(prompt(page)).toHaveCount(0)
})
test('a link to another puzzle keeps the saved game until its first move replaces it', async ({
  page,
}) => {
  await open(page)
  await play(page)
  await open(page, 7)
  await expect(page.locator('[data-state="empty"]')).toHaveCount(36)
  expect((await saved(page))?.seed).toBe(42)
  await cell(page, 5).click()
  await expect.poll(async () => (await saved(page))?.seed).toBe(7)
})
test('discarding the saved game starts fresh and forgets it', async ({ page }) => {
  await open(page)
  await play(page)
  await page.goto('/solo')
  await prompt(page).getByRole('button', { name: '放棄，開始新遊戲' }).click()
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-state="empty"]')).not.toHaveCount(0)
  expect(await saved(page)).toBeNull()
  await page.goto('/solo')
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  await expect(prompt(page)).toHaveCount(0)
})
test('finishing or restarting a game removes its save', async ({ page }) => {
  await open(page)
  await play(page)
  await page.getByRole('button', { name: '重新開始', exact: true }).click()
  await page
    .locator('.confirm-inline')
    .getByRole('button', { name: '重新開始', exact: true })
    .click()
  await expect.poll(() => saved(page)).toBeNull()
  const regions = await page
    .getByRole('gridcell')
    .evaluateAll((elements) => elements.map((el) => Number(el.getAttribute('data-region'))))
  const board = Array.from({ length: 6 }, (_, r) => regions.slice(r * 6, (r + 1) * 6))
  for (const [r, c] of solve(board).solutions[0].entries()) await queen(page, r * 6 + c)
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
  await expect.poll(() => saved(page)).toBeNull()
  await page.goto('/solo')
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  await expect(prompt(page)).toHaveCount(0)
})
test('corrupt or outdated saves are ignored', async ({ page }) => {
  await open(page)
  await play(page)
  const good = await page.evaluate((key) => localStorage.getItem(key)!, KEY)
  for (const value of [
    '{not json',
    JSON.stringify({ ...JSON.parse(good), version: '0.0.1' }),
    JSON.stringify({ ...JSON.parse(good), cells: 'zz' }),
  ]) {
    // Leave through a same-origin page without the game, so leaving cannot rewrite the save.
    await page.goto('/api/health')
    await page.evaluate(([key, text]) => localStorage.setItem(key, text), [KEY, value])
    await page.goto('/solo')
    await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
    await expect(prompt(page)).toHaveCount(0)
  }
})
test('a daily challenge resumes on the same board and keeps its badge', async ({ page }) => {
  const today = '2026-10-27'
  await page.clock.setFixedTime(new Date(`${today}T10:00:00+08:00`))
  await page.goto('/?daily=today')
  const { size } = dailyConfig(today)
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  const regions = await page
    .getByRole('gridcell')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-region')))
  await cell(page, 0).click()
  await expect.poll(async () => (await saved(page))?.moves).toBe(1)
  await page.goto('/?daily=today')
  await expect(page.getByRole('gridcell')).toHaveCount(size * size, { timeout: 60000 })
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked')
  await expect(page.locator('.daily-badge')).toBeVisible()
  expect(
    await page
      .getByRole('gridcell')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-region'))),
  ).toEqual(regions)
})
test('playing still works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await open(page)
  await queen(page, 0)
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
  await page.goto('/solo')
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
})

test('while the resume question is open, the header describes the saved game', async ({ page }) => {
  await page.goto('/solo?size=6&difficulty=hard&seed=42')
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  await page.getByRole('gridcell').first().click()
  await page.goto('/solo')
  await expect(page.getByRole('group', { name: '繼續上一局？' })).toBeVisible()
  await expect(page.locator('.puzzle-meta')).toContainText('挑戰')
  await expect(page.locator('.puzzle-meta')).toContainText('6 × 6')
})
