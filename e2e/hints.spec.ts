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
// One click marks a cell with an X and a second click turns it into a queen.
async function queen(page: Page, i: number) {
  await cell(page, i).click()
  await cell(page, i).click()
}
const hintButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
async function start(page: Page) {
  await page.goto(`/solo?size=6&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
}

test('a hint reveals where to look, then the technique, then the answer', async ({ page }) => {
  await start(page)
  const feedback = page.locator('.feedback')
  await hintButton(page, '給我一點提示').click()
  await expect(feedback).toContainText('邏輯提示 1 / 3')
  await expect(feedback).toContainText('先看看')
  await expect(page.getByRole('button', { name: '套用這一步 →' })).toHaveCount(0)
  const looking = await page.locator('.cell.highlighted').count()
  expect(looking).toBeGreaterThan(0)
  await expect(feedback).not.toContainText('放皇冠一定會造成接觸')

  await hintButton(page, '再多一點提示').click()
  await expect(feedback).toContainText('邏輯提示 2 / 3')
  await expect(feedback).toContainText('相鄰排除')
  await expect(page.getByRole('button', { name: '套用這一步 →' })).toHaveCount(0)
  await expect(page.locator('.cell.highlighted')).toHaveCount(looking)
  await expect(feedback).not.toContainText('放皇冠一定會造成接觸')

  await hintButton(page, '告訴我答案').click()
  await expect(feedback).toContainText('邏輯提示 3 / 3')
  await expect(feedback).toContainText('放皇冠一定會造成接觸')
  await expect(page.getByRole('button', { name: '套用這一步 →' })).toBeVisible()
  await expect(hintButton(page, '答案已顯示')).toBeDisabled()
  // At the last level only the cells the step changes are marked.
  const answer = await page.locator('.cell.highlighted').count()
  expect(answer).toBeLessThan(looking)
  await page.getByRole('button', { name: '套用這一步 →' }).click()
  await expect(page.locator('[data-state="marked"]')).toHaveCount(answer)
  await expect(hintButton(page, '給我一點提示')).toBeEnabled()
})
test('changing the board starts the next hint from the first level again', async ({ page }) => {
  await start(page)
  await hintButton(page, '給我一點提示').click()
  await hintButton(page, '再多一點提示').click()
  await expect(page.locator('.feedback')).toContainText('邏輯提示 2 / 3')
  await cell(page, 0).click()
  await expect(page.locator('.feedback')).not.toContainText('邏輯提示')
  await expect(page.locator('.cell.highlighted')).toHaveCount(0)
  await cell(page, 0).click()
  await cell(page, 0).click()
  await hintButton(page, '給我一點提示').click()
  await expect(page.locator('.feedback')).toContainText('邏輯提示 1 / 3')
})
test('every hint level counts as a hint in the final result', async ({ page }) => {
  await start(page)
  await hintButton(page, '給我一點提示').click()
  await hintButton(page, '再多一點提示').click()
  await hintButton(page, '告訴我答案').click()
  const regions = await page
    .getByRole('gridcell')
    .evaluateAll((elements) => elements.map((el) => Number(el.getAttribute('data-region'))))
  const board = Array.from({ length: 6 }, (_, r) => regions.slice(r * 6, (r + 1) * 6))
  for (const [r, c] of solve(board).solutions[0].entries()) await queen(page, r * 6 + c)
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
  await expect(page.getByText(/3 次提示/)).toBeVisible()
})
