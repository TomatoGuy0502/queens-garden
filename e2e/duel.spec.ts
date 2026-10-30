import { test, expect, type Page } from '@playwright/test'
import { solve } from '../src/queens/solver'
const cell = (page: Page, index: number) => page.locator(`[data-index="${index}"]`)
async function queen(page: Page, i: number) {
  await cell(page, i).click()
  await expect(cell(page, i)).toHaveAttribute('data-state', 'marked')
  await cell(page, i).click()
  await expect(cell(page, i)).toHaveAttribute('data-state', 'queen')
}
const bar = (page: Page, name: string) =>
  page.locator('.duel-progress li').filter({ hasText: name }).locator('.duel-count')
test.beforeEach(({ page }) => page.on('dialog', (dialog) => void dialog.accept()))

test('two players race on their own boards with progress, no help, and a winner', async ({
  page,
  browser,
}) => {
  // Excluded cells would show here for a solo player; a duel must ignore the saved preference.
  await page.addInitScript(() =>
    localStorage.setItem(
      'queens:board-guidance:v1',
      JSON.stringify({ enabled: true, rows: true, columns: true, regions: true, adjacent: true }),
    ),
  )
  await page.goto('/')
  await page.getByRole('link', { name: '多人模式', exact: true }).click()
  await page.getByRole('link', { name: /^兩人對戰/ }).click()
  await page.getByLabel('你的暱稱').fill('Alice')
  await page.getByLabel('棋盤大小').selectOption('6')
  await page.getByRole('button', { name: '建立房間', exact: true }).click()
  await expect(page.getByRole('heading', { name: /等待室/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '開始對戰', exact: true })).toBeDisabled()
  const context = await browser.newContext({ locale: 'zh-TW' })
  const guest = await context.newPage()
  guest.on('dialog', (dialog) => void dialog.accept())
  try {
    await guest.goto(page.url())
    await guest.getByLabel('你的暱稱').fill('Bob')
    await guest.getByRole('button', { name: '加入房間', exact: true }).click()
    await expect(page.locator('.player-row')).toHaveCount(2)
    await page.getByRole('button', { name: '開始對戰', exact: true }).click()
    await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
    await expect(guest.getByRole('grid')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.hover-position')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '檢查錯誤' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '給我一點提示' })).toHaveCount(0)
    const regions = await page.getByRole('gridcell').evaluateAll((elements) => {
      const cells = elements.map((e) => Number(e.getAttribute('data-region')))
      return Array.from({ length: 6 }, (_, r) => cells.slice(r * 6, r * 6 + 6))
    })
    const solution = solve(regions).solutions[0]
    // Alice covers three rows; Bob sees the bar move but none of her queens.
    for (const row of [0, 1, 2]) await queen(page, row * 6 + solution[row])
    await expect(bar(guest, 'Alice')).toHaveText('3 / 6')
    await expect(guest.locator('[data-state="queen"]')).toHaveCount(0)
    await expect(page.locator('[data-guided="true"]')).toHaveCount(0)
    // Rows and columns all covered is 100%, even when the answer is wrong.
    const wrong = solution.map((_, row) => solution[(row + 1) % 6])
    for (const [row, col] of wrong.entries()) await queen(guest, row * 6 + col)
    await expect(bar(page, 'Bob')).toHaveText('6 / 6')
    await expect(guest.getByRole('heading', { name: '你贏了！' })).toHaveCount(0)
    // A reload keeps the board, which the server remembers.
    await page.reload()
    await expect(page.locator('[data-state="queen"]')).toHaveCount(3)
    await expect(bar(page, 'Alice')).toHaveText('3 / 6')
    for (const [row, col] of wrong.entries()) await cell(guest, row * 6 + col).click()
    for (const [row, col] of solution.entries()) await queen(guest, row * 6 + col)
    await expect(guest.getByRole('heading', { name: '你贏了！' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '你輸了' })).toBeVisible()
    await expect(bar(page, 'Alice')).toHaveText('3 / 6')
    await expect(bar(page, 'Bob')).toHaveText('6 / 6')
    // Only the host can change the round, and the reload above handed hosting to Bob.
    await expect(page.getByRole('button', { name: '更換關卡' })).toHaveCount(0)
    await guest.getByRole('button', { name: '更換關卡' }).click()
    await guest.getByRole('button', { name: '回到等待室' }).click()
    await expect(page.getByRole('heading', { name: /等待室/ })).toBeVisible()
    await expect(guest.getByRole('heading', { name: /等待室/ })).toBeVisible()
  } finally {
    await context.close()
  }
})
