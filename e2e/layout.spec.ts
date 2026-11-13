import { test, expect, type Page } from '@playwright/test'
import { GENERATOR_VERSION } from '../src/queens/version'

async function settings(page: Page) {
  await page.getByRole('button', { name: '遊玩設定', exact: true }).click()
  return page.getByRole('dialog', { name: '遊玩設定', exact: true })
}
async function stacked(page: Page) {
  const board = (await page.locator('.board-stage').boundingBox())!
  const panel = (await page.locator('.side-panel').boundingBox())!
  expect(panel.y).toBeGreaterThan(board.y + board.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

test('expanded board moves settings below the board, preserves play and remembers the preference', async ({
  page,
  isMobile,
}) => {
  await page.goto(`/?size=6&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(36)
  const original = (await page.locator('.board-stage').boundingBox())!
  const first = page.locator('[data-index="0"]')
  await first.click()
  await first.click()
  const dialog = await settings(page)
  await expect(dialog.getByRole('switch', { name: '放大棋盤', exact: true })).not.toBeChecked()
  await dialog.getByRole('switch', { name: '放大棋盤', exact: true }).check()
  await dialog.getByRole('button', { name: '關閉設定', exact: true }).click()
  await stacked(page)
  const expanded = (await page.locator('.board-stage').boundingBox())!
  if (!isMobile) expect(expanded.width).toBeGreaterThan(original.width * 1.5)
  else expect(expanded.width).toBeCloseTo(original.width, 0)
  await expect(first).toHaveAttribute('data-state', 'queen')
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await expect(first).toHaveAttribute('data-state', 'marked')
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(first).toHaveAttribute('data-state', 'queen')
  await page.reload()
  await expect(page.getByRole('gridcell')).toHaveCount(36)
  await stacked(page)
  const reopened = await settings(page)
  await expect(reopened.getByRole('switch', { name: '放大棋盤', exact: true })).toBeChecked()
  await reopened.getByRole('switch', { name: '放大棋盤', exact: true }).uncheck()
  await reopened.getByRole('button', { name: '關閉設定', exact: true }).click()
  const restored = (await page.locator('.board-stage').boundingBox())!
  expect(restored.width).toBeCloseTo(original.width, 0)
})

test('expanded board remains usable across routes when browser storage is blocked', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        throw new Error('Storage blocked')
      },
    })
  })
  await page.goto('/')
  const dialog = await settings(page)
  await dialog.getByRole('switch', { name: '放大棋盤', exact: true }).check()
  await expect(dialog.getByRole('status')).toContainText('無法儲存')
  await dialog.getByRole('button', { name: '關閉設定', exact: true }).click()
  await page.getByRole('link', { name: '多人模式', exact: true }).click()
  await page.getByRole('link', { name: /^多人合作/ }).click()
  await expect(page.getByRole('heading', { name: '建立房間', exact: true })).toBeVisible()
  const coopSettings = await settings(page)
  await expect(coopSettings.getByRole('switch', { name: '放大棋盤', exact: true })).toBeChecked()
  await coopSettings.getByRole('button', { name: '關閉設定', exact: true }).click()
  await page.getByRole('link', { name: '單人遊戲', exact: true }).click()
  await page.getByRole('link', { name: /^經典 Queens/ }).click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await stacked(page)
  expect(errors).toEqual([])
})

test('play settings close from the cross or by clicking outside, but not from inside the dialog', async ({
  page,
}) => {
  await page.goto('/solo?size=6&difficulty=easy&seed=42')
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  const dialog = page.getByRole('dialog', { name: '遊玩設定', exact: true })
  const open = () => page.getByRole('button', { name: '遊玩設定', exact: true }).click()
  await open()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '完成', exact: true })).toHaveCount(0)
  await dialog.getByRole('heading', { name: '遊玩設定' }).click()
  await expect(dialog).toBeVisible()
  await page.mouse.click(4, 4)
  await expect(dialog).toBeHidden()
  await open()
  await dialog.getByRole('button', { name: '關閉設定', exact: true }).click()
  await expect(dialog).toBeHidden()
})

test('dragging across cells marks them, and a drag from an X clears them', async ({ page }) => {
  await page.goto(`/?size=6&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(36)
  const centre = async (index: number) => {
    const box = (await page.locator(`[data-index="${index}"]`).boundingBox())!
    return [box.x + box.width / 2, box.y + box.height / 2] as const
  }
  const drag = async (from: number, to: number) => {
    await page.mouse.move(...(await centre(from)))
    await page.mouse.down()
    for (let index = from + 1; index <= to; index++)
      await page.mouse.move(...(await centre(index)), { steps: 3 })
    await page.mouse.up()
  }
  const states = () =>
    Promise.all(
      [0, 1, 2, 3].map((i) => page.locator(`[data-index="${i}"]`).getAttribute('data-state')),
    )
  await drag(0, 3)
  expect(await states()).toEqual(['marked', 'marked', 'marked', 'marked'])
  await drag(0, 2)
  expect(await states()).toEqual(['empty', 'empty', 'empty', 'marked'])
  await page.getByRole('button', { name: '復原', exact: true }).click()
  expect(await states()).toEqual(['empty', 'empty', 'marked', 'marked'])
})

test('the larger board fits a phone without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/?size=12&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(144, { timeout: 60000 })
  const dialog = await settings(page)
  await dialog.getByRole('switch', { name: '放大棋盤', exact: true }).check()
  await dialog.getByRole('button', { name: '關閉設定', exact: true }).click()
  const scroller = page.locator('.board-scroll')
  expect(await scroller.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})
