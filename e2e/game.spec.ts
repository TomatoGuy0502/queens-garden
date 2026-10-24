import { test, expect } from '@playwright/test'
import { solve } from '../src/queens/solver'
import type { Page } from '@playwright/test'
const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(entry.text())
  })
})
test.afterEach(({ page }) => {
  expect(browserErrors.get(page)).toEqual([])
})
async function start(page: Page) {
  await page.goto('/?size=6&difficulty=easy&seed=42&v=1.0.0')
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('gridcell')).toHaveCount(36)
}
const cell = (page: Page, i: number) => page.locator(`[data-index="${i}"]`)
async function readRegions(page: Page) {
  const flat = await page
    .getByRole('gridcell')
    .evaluateAll((elements) => elements.map((el) => Number(el.getAttribute('data-region'))))
  const n = Math.sqrt(flat.length)
  return Array.from({ length: n }, (_, r) => flat.slice(r * n, (r + 1) * n))
}

test('cycle empty queen marked empty, undo, redo, keyboard navigation and restart', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await start(page)
  await cell(page, 0).click()
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
  await cell(page, 0).click()
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked')
  await cell(page, 0).click()
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'empty')
  await expect(page.getByRole('group', { name: '放置模式' })).toHaveCount(0)
  await cell(page, 1).click()
  await expect(cell(page, 1)).toHaveAttribute('data-state', 'queen')
  await cell(page, 1).click()
  await expect(cell(page, 1)).toHaveAttribute('data-state', 'marked')
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await expect(cell(page, 1)).toHaveAttribute('data-state', 'queen')
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(cell(page, 1)).toHaveAttribute('data-state', 'marked')
  if (!isMobile) {
    await cell(page, 2).click({ button: 'right' })
    await expect(cell(page, 2)).toHaveAttribute('data-state', 'marked')
    await cell(page, 0).focus()
    await page.keyboard.press('ArrowDown')
    await expect(cell(page, 6)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(cell(page, 6)).toHaveAttribute('data-state', 'queen')
    await page.keyboard.press('Space')
    await expect(cell(page, 6)).toHaveAttribute('data-state', 'marked')
    await page.keyboard.press('Enter')
    await expect(cell(page, 6)).toHaveAttribute('data-state', 'empty')
    await page.keyboard.press('x')
    await expect(cell(page, 6)).toHaveAttribute('data-state', 'marked')
  }
  await expect(page.locator('.timer > span')).not.toHaveText('00:00')
  await page.getByRole('button', { name: '重新開始', exact: true }).click()
  const confirm = page
    .locator('.restart-confirm')
    .getByRole('button', { name: '重新開始', exact: true })
  await expect(confirm).toBeVisible()
  // Capture the reset after Vue's DOM flush, before real time can advance another second.
  const resetTime = await confirm.evaluate(async (button: HTMLButtonElement) => {
    button.click()
    await Promise.resolve()
    return document.querySelector('.timer > span')?.textContent
  })
  expect(resetTime).toBe('00:00')
  await expect(page.locator('[data-state="empty"]')).toHaveCount(36)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('invalid placement never wins; valid solution completes with summary', async ({ page }) => {
  await start(page)
  for (let i = 0; i < 6; i++) await cell(page, i).click()
  await expect(page.getByText('所有皇冠，都恰如其分。')).not.toBeVisible()
  await expect(page.locator('.cell.mistake')).toHaveCount(6)
  for (let i = 0; i < 6; i++) {
    await cell(page, i).click()
    await cell(page, i).click()
  }
  const regions = await readRegions(page)
  const result = solve(regions)
  expect(result.solutionCount).toBe(1)
  for (const [r, c] of result.solutions[0].entries()) await cell(page, r * 6 + c).click()
  await expect(page.getByRole('heading', { name: '所有皇冠，都恰如其分。' })).toBeVisible()
  await expect(page.getByText(/次操作 · 0 次提示/)).toBeVisible()
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await expect(page.getByRole('heading', { name: '所有皇冠，都恰如其分。' })).not.toBeVisible()
})
test('pause conceals board and freezes timer; hint explains and safely applies', async ({
  page,
}) => {
  await start(page)
  await page.waitForTimeout(1100)
  await page.getByRole('button', { name: '暫停遊戲', exact: true }).click()
  const time = await page.locator('.timer > span').innerText()
  await page.waitForTimeout(1100)
  await expect(page.locator('.timer > span')).toHaveText(time)
  await expect(page.getByRole('grid')).not.toBeVisible()
  await page.getByRole('button', { name: '繼續遊戲', exact: true }).last().click()
  await page.getByRole('button', { name: '給我一點提示', exact: true }).click()
  await expect(page.getByRole('button', { name: '套用這一步 →' })).toBeVisible()
  await expect(page.locator('.feedback')).toContainText('只剩一個候選格')
  await page.getByRole('button', { name: '套用這一步 →' }).click()
  await expect(page.locator('[data-state="queen"]')).toHaveCount(1)
  await page.getByRole('button', { name: '檢查錯誤', exact: true }).click()
  await expect(page.locator('.feedback')).toContainText('都正確')
})
test('new game uses submitted settings and survives reload by seed', async ({ page }) => {
  await start(page)
  const oldRegions = await readRegions(page)
  await page.getByLabel('關卡種子').fill('1')
  await page.getByRole('button', { name: '開始新遊戲', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.puzzle-footer')).toContainText('SEED 1')
  const newRegions = await readRegions(page)
  expect(newRegions).not.toEqual(oldRegions)
  await page.reload()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  expect(await readRegions(page)).toEqual(newRegions)
})

test('canceling generation recovers cleanly and an obsolete version can start a current puzzle', async ({
  page,
}) => {
  await page.goto('/?size=6&difficulty=easy&seed=42&v=old')
  await expect(page.getByRole('heading', { name: '此連結使用不同版本的生成器' })).toBeVisible()
  await page.getByRole('button', { name: '開始新遊戲', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await page.getByLabel('棋盤大小').selectOption('12')
  await page.getByLabel('關卡種子').fill('42')
  await page.getByRole('button', { name: '適中', exact: true }).click()
  await page.getByRole('button', { name: '開始新遊戲', exact: true }).click()
  await page.getByRole('button', { name: '取消生成', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('已取消生成')
  await page.getByLabel('棋盤大小').selectOption('6')
  await page.getByRole('button', { name: '輕鬆', exact: true }).click()
  await page.getByRole('button', { name: '開始新遊戲', exact: true }).click()
  await expect(page.getByRole('gridcell')).toHaveCount(36)
  await expect(page.getByRole('alert')).not.toBeVisible()
})

test('contradictory placements get contradiction feedback before any hint', async ({ page }) => {
  await start(page)
  await cell(page, 0).click()
  await cell(page, 1).click()
  await page.getByRole('button', { name: '給我一點提示', exact: true }).click()
  await expect(page.locator('.feedback')).toContainText('矛盾')
  await expect(page.getByRole('button', { name: '套用這一步 →' })).not.toBeVisible()
})

test('large boards retain touch targets without widening the document', async ({ page }) => {
  await page.goto('/?size=12&difficulty=easy&seed=42&v=1.0.0')
  await expect(page.getByRole('gridcell')).toHaveCount(144, { timeout: 30000 })
  expect((await cell(page, 0).boundingBox())!.width).toBeGreaterThanOrEqual(40)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await cell(page, 143).click()
  await expect(cell(page, 143)).toHaveAttribute('data-state', 'queen')
})
