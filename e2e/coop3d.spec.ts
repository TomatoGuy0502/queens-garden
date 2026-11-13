import { test, expect, type Page } from '@playwright/test'
const cell = (page: Page, layer: number, index: number) =>
  page.locator(`[data-layer="${layer}"][data-index="${index}"]`)
test.beforeEach(({ page }) => page.on('dialog', (dialog) => void dialog.accept()))

test('a co-op room plays a stacked board that both players see', async ({
  page: host,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, 'The layers are tabs on a narrow screen; layout has its own tests.')
  const context = await browser.newContext({ locale: 'zh-TW' })
  const guest = await context.newPage()
  try {
    await host.goto('/rooms/new')
    await host.getByLabel('你的暱稱').fill('Alice')
    await host.getByRole('button', { name: '建立房間', exact: true }).click()
    await expect(host.getByRole('heading', { name: /等待室/ })).toBeVisible()
    await host.getByLabel('棋盤類型').selectOption('stacked')
    await expect(host.getByLabel('棋盤大小')).toHaveValue('5')
    await guest.goto(host.url())
    await guest.getByLabel('你的暱稱').fill('Bob')
    await guest.getByRole('button', { name: '加入房間', exact: true }).click()
    // The guest sees the host's choice but cannot change it.
    await expect(guest.getByLabel('棋盤類型')).toHaveValue('stacked')
    await expect(guest.getByLabel('棋盤類型')).toBeDisabled()
    await host.getByRole('button', { name: '開始合作', exact: true }).click()
    for (const page of [host, guest]) {
      await expect(page.locator('[data-layer="4"][data-index="24"]')).toBeVisible({
        timeout: 50000,
      })
      await expect(page.locator('[data-layer]')).toHaveCount(125)
    }
    // Pointer position is named by layer, row and column.
    await cell(host, 2, 7).hover()
    await expect(guest.locator('.hover-position').first()).toContainText('第 3 層 2,3')
    // Two clicks: X, then a crown, which the other player sees on the same layer.
    await cell(host, 2, 7).click()
    await expect(cell(host, 2, 7)).toHaveAttribute('data-state', 'marked')
    await cell(host, 2, 7).click()
    await expect(cell(guest, 2, 7)).toHaveAttribute('data-state', 'queen')
    await expect(cell(guest, 0, 7)).toHaveAttribute('data-state', 'empty')
    await expect(guest.getByText('1 / 25')).toBeVisible()
  } finally {
    await context.close()
  }
})
