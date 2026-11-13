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
    await expect(host.locator('.kind-card .badge')).toHaveText('NEW')
    await host.getByRole('radio', { name: '疊層（3D）' }).check()
    await expect(host.getByLabel('棋盤大小')).toHaveValue('5')
    await guest.goto(host.url())
    await guest.getByLabel('你的暱稱').fill('Bob')
    await guest.getByRole('button', { name: '加入房間', exact: true }).click()
    // The guest sees the host's choice but cannot change it.
    await expect(guest.getByRole('radio', { name: '疊層（3D）' })).toBeChecked()
    await expect(guest.getByRole('radio', { name: '疊層（3D）' })).toBeDisabled()
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

test('the lobby shows a board choice at once, before the server has answered', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The lobby is the same on a phone.')
  await page.goto('/rooms/new')
  await page.getByLabel('你的暱稱').fill('Alice')
  await page.getByRole('button', { name: '建立房間', exact: true }).click()
  await expect(page.getByRole('heading', { name: /等待室/ })).toBeVisible()
  // Hold every command back so only a local update can explain the change.
  await page.routeWebSocket(/socket\.io/, (ws) => {
    const server = ws.connectToServer()
    ws.onMessage((message) =>
      typeof message === 'string' && message.includes('room:command')
        ? void setTimeout(() => server.send(message), 1500)
        : server.send(message),
    )
    server.onMessage((message) => ws.send(message))
  })
  await page.reload()
  await expect(page.getByRole('radio', { name: '經典（2D）' })).toBeChecked()
  await page.getByRole('radio', { name: '疊層（3D）' }).check({ force: true })
  await expect(page.locator('.kind-card.selected')).toContainText('疊層（3D）', { timeout: 500 })
  await expect(page.getByLabel('棋盤大小')).toHaveValue('5', { timeout: 500 })
  // Only starting waits for the change; the other settings stay editable meanwhile.
  await expect(page.getByLabel('棋盤大小')).toBeEnabled()
  await expect(page.getByLabel('難度')).toBeEnabled()
  await expect(page.getByRole('radio', { name: '經典（2D）' })).toBeEnabled()
  await expect(page.getByRole('button', { name: '開始合作', exact: true })).toBeDisabled()
  // The room's answer arrives and agrees with it.
  await expect(page.getByLabel('棋盤大小')).toBeEnabled()
  await expect(page.locator('.kind-card.selected')).toContainText('疊層（3D）')
})
