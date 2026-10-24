import { test, expect, type Page } from '@playwright/test'
import { solve } from '../src/queens/solver'
import { GENERATOR_VERSION } from '../src/queens/version'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

const cell = (page: Page, i: number) => page.locator(`[data-index="${i}"]`)
async function open(page: Page, seed: number) {
  await page.goto(`/solo?size=6&difficulty=easy&seed=${seed}&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
}
async function solvePuzzle(page: Page) {
  const regions = await page
    .getByRole('gridcell')
    .evaluateAll((elements) => elements.map((el) => Number(el.getAttribute('data-region'))))
  const board = Array.from({ length: 6 }, (_, r) => regions.slice(r * 6, (r + 1) * 6))
  const result = solve(board)
  expect(result.solutionCount).toBe(1)
  for (const [r, c] of result.solutions[0].entries()) await cell(page, r * 6 + c).click()
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
}

test('completed solo games are scored once and shown on the stats page', async ({ page }) => {
  await page.goto('/stats')
  await expect(page.getByText('還沒有完成紀錄')).toBeVisible()
  await open(page, 42)
  await solvePuzzle(page)
  await expect(page.getByText('第一次完成這個大小與難度，成績已記錄')).toBeVisible()
  // Undoing and redoing the winning move is the same attempt and must not be counted again.
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
  await page.getByRole('link', { name: '我的成績', exact: true }).click()
  await expect(page.getByText('共完成 1 局')).toBeVisible()
  const row = page.getByRole('row', { name: /6 × 6/ })
  await expect(row).toContainText('1 局 · 1 局無提示')
  await expect(page.getByRole('columnheader', { name: '專家' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('共完成 1 局')).toBeVisible()
})
test('a faster repeat shows a personal best and a slower one shows the old best', async ({
  page,
}) => {
  await open(page, 42)
  await page.waitForTimeout(2200)
  await solvePuzzle(page)
  await expect(page.getByText('第一次完成這個大小與難度，成績已記錄')).toBeVisible()
  await page.getByRole('button', { name: '重新開始', exact: true }).click()
  await page
    .locator('.restart-confirm')
    .getByRole('button', { name: '重新開始', exact: true })
    .click()
  await solvePuzzle(page)
  await expect(page.getByText(/^新紀錄！原本最佳 00:0[2-4]$/)).toBeVisible()
  await page.getByRole('button', { name: '重新開始', exact: true }).click()
  await page
    .locator('.restart-confirm')
    .getByRole('button', { name: '重新開始', exact: true })
    .click()
  await page.waitForTimeout(2200)
  await solvePuzzle(page)
  await expect(page.getByText(/此大小與難度的最佳時間 00:0[0-2]/)).toBeVisible()
  await page.goto('/stats')
  await expect(page.getByText('共完成 3 局')).toBeVisible()
})
test('stats can be cleared after confirmation', async ({ page }) => {
  await open(page, 7)
  await solvePuzzle(page)
  await page.goto('/stats')
  await expect(page.getByText('共完成 1 局')).toBeVisible()
  await page.getByRole('button', { name: '清除成績', exact: true }).click()
  await page.getByRole('button', { name: '保留', exact: true }).click()
  await expect(page.getByText('共完成 1 局')).toBeVisible()
  await page.getByRole('button', { name: '清除成績', exact: true }).click()
  await page.getByRole('button', { name: '清除', exact: true }).click()
  await expect(page.getByText('還沒有完成紀錄')).toBeVisible()
})
test('scoring keeps working for the session when browser storage is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await open(page, 42)
  await solvePuzzle(page)
  await expect(page.getByText('第一次完成這個大小與難度，成績已記錄')).toBeVisible()
  await page.getByRole('link', { name: '我的成績', exact: true }).click()
  await expect(page.getByText('共完成 1 局')).toBeVisible()
  await expect(page.getByText('瀏覽器拒絕儲存')).toBeVisible()
})
