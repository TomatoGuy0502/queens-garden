import { test, expect, type Page } from '@playwright/test'
import { renderSource } from '../src/i18n/source'
import { solve } from '../src/queens/solver'
import { TUTORIAL_PUZZLE, buildLessons } from '../src/queens/tutorial'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

const lessons = buildLessons()
const lesson = (id: string) => lessons.find((item) => item.id === id)!
const cell = (page: Page, i: number) => page.locator(`[data-index="${i}"]`)
const next = (page: Page) => page.getByRole('button', { name: '下一課 →' })
const done = (page: Page) => expect(page.getByText('完成了！可以進入下一課。')).toBeVisible()
const title = (page: Page, text: string) =>
  expect(page.getByRole('heading', { name: text, level: 2 })).toBeVisible()

test('the tutorial walks through rules, marks, conflicts and three techniques to a finished board', async ({
  page,
}) => {
  await page.goto('/tutorial')
  await expect(page.getByRole('heading', { name: '新手教學', level: 1 })).toBeVisible()
  await title(page, '認識規則')
  await expect(page.getByText('第 1 / 9 課')).toBeVisible()
  await expect(page.getByRole('button', { name: '上一課' })).toBeDisabled()
  await next(page).click()

  await title(page, '放下皇冠')
  await expect(next(page)).toBeDisabled()
  await cell(page, 0).click()
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
  await done(page)
  await next(page).click()

  await title(page, '用 X 整理想法')
  await expect(page.locator('[data-state="queen"]')).toHaveCount(0)
  await expect(next(page)).toBeDisabled()
  await cell(page, 3).click()
  await cell(page, 3).click()
  await expect(cell(page, 3)).toHaveAttribute('data-state', 'marked')
  await next(page).click()

  await title(page, '皇冠不能相鄰')
  await expect(page.locator('.cell.mistake')).toHaveCount(2)
  await expect(next(page)).toBeDisabled()
  await cell(page, 14).click()
  await expect(page.locator('.cell.mistake')).toHaveCount(0)
  await next(page).click()

  for (const id of ['adjacency', 'intersection'] as const) {
    const current = lesson(id)
    if (current.goal.type !== 'mark-all') throw new Error('unexpected goal')
    await title(page, renderSource(current.title))
    await expect(next(page)).toBeDisabled()
    for (const c of current.goal.cells.slice(0, -1)) {
      await cell(page, c).click()
      await cell(page, c).click()
    }
    await expect(next(page)).toBeDisabled()
    const last = current.goal.cells.at(-1)!
    await cell(page, last).click()
    await cell(page, last).click()
    await done(page)
    await next(page).click()
  }

  const single = lesson('single')
  if (single.goal.type !== 'queen-at') throw new Error('unexpected goal')
  await title(page, renderSource(single.title))
  await cell(page, single.goal.cell).click()
  await done(page)
  await next(page).click()

  await title(page, '換你完成')
  await page.getByRole('button', { name: '給我提示' }).click()
  await expect(page.locator('.hint')).not.toBeEmpty()
  const solution = solve(TUTORIAL_PUZZLE.regions).solutions[0]
  for (const [row, col] of solution.entries()) {
    const target = cell(page, row * 6 + col)
    if ((await target.getAttribute('data-state')) === 'empty') await target.click()
  }
  await expect(page.locator('[data-state="queen"]')).toHaveCount(6)
  await done(page)
  await next(page).click()

  await title(page, '你學會了！')
  await expect(page.locator('[data-state="queen"]')).toHaveCount(6)
  await cell(page, 0).click()
  await expect(page.locator('[data-state="queen"]')).toHaveCount(6)
  await expect(page.getByRole('link', { name: '開始遊戲' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('queens:tutorial:v1'))).toBe('done')
  await page.getByRole('link', { name: '開始遊戲' }).click()
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('region', { name: '新手教學' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('lessons can be reset, revisited and skipped', async ({ page }) => {
  await page.goto('/tutorial')
  await next(page).click()
  await title(page, '放下皇冠')
  await expect(next(page)).toBeDisabled()
  await cell(page, 0).click()
  await page.getByRole('button', { name: '重設這一課' }).click()
  await expect(page.locator('[data-state="queen"]')).toHaveCount(0)
  await page.getByRole('button', { name: '跳過這一課' }).click()
  await title(page, '用 X 整理想法')
  await page.getByRole('button', { name: '上一課' }).click()
  await title(page, '放下皇冠')
  await expect(page.locator('[data-state="queen"]')).toHaveCount(0)
})
test('new players are offered the tutorial once and can dismiss it for good', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /新手教學/ }).first()).toBeVisible()
  await page.goto('/solo?size=6&difficulty=easy&seed=42')
  const prompt = page.getByRole('region', { name: '新手教學' })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: '不用了' }).click()
  await expect(prompt).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  await expect(prompt).toHaveCount(0)
  await page.goto('/tutorial')
  await expect(page.getByRole('heading', { name: '認識規則' })).toBeVisible()
})
test('the tutorial works without browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await page.goto('/tutorial')
  await next(page).click()
  await cell(page, 0).click()
  await done(page)
})
