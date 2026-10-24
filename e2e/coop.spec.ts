import { test, expect, type Browser, type Page } from '@playwright/test'
import { solve } from '../src/queens/solver'
const cell = (page: Page, index: number) => page.locator(`[data-index="${index}"]`)
async function pair(host: Page, browser: Browser, mobile: boolean) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 720 },
    isMobile: mobile,
    hasTouch: mobile,
  })
  const guest = await context.newPage()
  await host.goto('/rooms/new')
  await host.getByLabel('你的暱稱').fill('Alice')
  await host.getByLabel('棋盤大小').selectOption('6')
  await host.getByRole('button', { name: '建立房間', exact: true }).click()
  await expect(host).toHaveURL(/\/rooms\/[a-f0-9]{12}$/)
  await expect(host.getByRole('heading', { name: /等待室/ })).toBeVisible()
  await guest.goto(host.url())
  await guest.getByLabel('你的暱稱').fill('Bob')
  await guest.getByRole('button', { name: '加入房間', exact: true }).click()
  await expect(guest.getByRole('heading', { name: /等待室/ })).toBeVisible()
  await expect(host.locator('.player-row')).toHaveCount(2)
  await host.getByRole('button', { name: '準備好了', exact: true }).click()
  await guest.getByRole('button', { name: '準備好了', exact: true }).click()
  await host.getByRole('button', { name: '開始合作', exact: true }).click()
  await expect(host.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await expect(guest.getByRole('grid')).toBeVisible({ timeout: 30000 })
  return { guest, context }
}

test('two players share cells, personal undo, markers, hints and team completion', async ({
  page,
  browser,
  isMobile,
}) => {
  const { guest, context } = await pair(page, browser, isMobile)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  guest.on('pageerror', (e) => errors.push(e.message))
  try {
    await page.getByRole('button', { name: '邀請隊友', exact: true }).click()
    const invite = page.getByRole('dialog', { name: '邀請隊友' })
    expect(await invite.getByLabel('房間連結').inputValue()).toBe(page.url())
    await expect(invite.getByRole('img', { name: '房間 QR Code' })).toBeVisible()
    await invite.getByRole('button', { name: '關閉分享' }).click()
    await cell(page, 0).click()
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'queen')
    await cell(guest, 0).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked')
    await expect(page.getByRole('button', { name: '復原', exact: true })).toBeDisabled()
    await guest.getByRole('button', { name: '復原', exact: true }).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
    await guest.getByRole('button', { name: '重做', exact: true }).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked')
    await page.getByRole('button', { name: '指示格子', exact: true }).click()
    await cell(page, 7).click()
    await expect(cell(guest, 7)).toHaveAttribute('data-pointed', 'true')
    await expect(cell(guest, 7)).toContainText('Alice')
    await expect(cell(guest, 7)).toHaveAttribute('data-state', 'empty')
    // Clear our shared mark, then request a safe explanatory team hint.
    await cell(page, 0).click()
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'empty')
    await page.getByRole('button', { name: '給我一點提示', exact: true }).click()
    await expect(guest.getByRole('button', { name: '套用這一步 →' })).toBeVisible({
      timeout: 15000,
    })
    await guest.getByRole('button', { name: '套用這一步 →' }).click()
    await expect(page.locator('[data-state="marked"]')).not.toHaveCount(0)
    const regions = await page.getByRole('gridcell').evaluateAll((elements) => {
      const cells = elements.map((e) => Number(e.getAttribute('data-region')))
      return Array.from({ length: 6 }, (_, r) => cells.slice(r * 6, r * 6 + 6))
    })
    const solution = solve(regions).solutions[0]
    // Hint marks remain; correct queen positions are still empty.
    for (const [row, col] of solution.entries()) {
      const actor = row % 2 ? guest : page
      await cell(actor, row * 6 + col).click()
      await expect(cell(row % 2 ? page : guest, row * 6 + col)).toHaveAttribute(
        'data-state',
        'queen',
      )
    }
    await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
    await expect(guest.getByRole('heading', { name: '關卡完成' })).toBeVisible()
    await expect(guest.getByRole('button', { name: '等待房主開啟下一局' })).toBeDisabled()
    await page.getByRole('button', { name: '開啟下一局 →' }).click()
    await expect(page.getByRole('heading', { name: /等待室/ })).toBeVisible()
    await expect(guest.getByRole('heading', { name: /等待室/ })).toBeVisible()
    expect(errors).toEqual([])
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    )
  } finally {
    await context.close()
  }
})

test('guest reload restores identity and board; disconnect pauses and reconnect can resume', async ({
  page,
  browser,
  isMobile,
}) => {
  const { guest, context } = await pair(page, browser, isMobile)
  try {
    await cell(page, 0).click()
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'queen')
    await context.setOffline(true)
    await expect(page.getByRole('button', { name: '繼續合作', exact: true })).toBeVisible({
      timeout: 25000,
    })
    await expect(page.getByRole('button', { name: '繼續合作', exact: true })).toBeDisabled()
    await context.setOffline(false)
    await expect(page.getByRole('button', { name: '繼續合作', exact: true })).toBeEnabled({
      timeout: 20000,
    })
    await page.getByRole('button', { name: '繼續合作', exact: true }).click()
    await expect(guest.getByRole('grid')).toBeVisible()
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'queen')
    await guest.reload()
    await expect(guest.locator('.presence-bar')).toContainText('Bob（你）')
    await expect(guest.getByRole('button', { name: '加入房間', exact: true })).toHaveCount(0)
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'queen')
  } finally {
    await context.close()
  }
})

test('navigation between home, solo and cooperation preserves working solo controls', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: '單人遊戲' }).last().click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await page.getByRole('link', { name: '多人合作', exact: true }).click()
  await expect(page.getByRole('heading', { name: '建立房間' })).toBeVisible()
  await page.getByRole('link', { name: '單人遊戲', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await cell(page, 0).click()
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
  await expect(page.locator('.timer > span')).not.toHaveText('00:00')
})

test('three players prepare, synchronize edits and pointers, reconnect and finish together', async ({
  page,
  browser,
  isMobile,
}) => {
  test.setTimeout(90000)
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({
        viewport: isMobile ? { width: 393, height: 851 } : { width: 1280, height: 720 },
        isMobile,
        hasTouch: isMobile,
      }),
    ),
  )
  const guests = await Promise.all(contexts.map((context) => context.newPage()))
  const pages = [page, ...guests]
  const errors: string[] = []
  for (const p of pages) p.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto('/rooms/new')
    await page.getByLabel('你的暱稱').fill('Alice')
    await page.getByLabel('棋盤大小').selectOption('6')
    await page.getByRole('button', { name: '建立房間', exact: true }).click()
    await expect(page.getByRole('heading', { name: /等待室/ })).toBeVisible()
    for (const [i, guest] of guests.entries()) {
      await guest.goto(page.url())
      await guest.getByLabel('你的暱稱').fill(['Bob', 'Charlie'][i])
      await guest.getByRole('button', { name: '加入房間', exact: true }).click()
      await expect(guest.getByRole('heading', { name: /等待室/ })).toBeVisible()
    }
    await expect(page.locator('.player-count')).toHaveText('3 / 8 人')
    await page.getByRole('button', { name: '準備好了', exact: true }).click()
    await guests[0].getByRole('button', { name: '準備好了', exact: true }).click()
    await expect(page.getByRole('button', { name: '開始合作', exact: true })).toBeDisabled()
    await guests[1].getByRole('button', { name: '準備好了', exact: true }).click()
    await page.getByRole('button', { name: '開始合作', exact: true }).click()
    for (const p of pages) await expect(p.getByRole('grid')).toBeVisible({ timeout: 30000 })
    await cell(guests[1], 0).click()
    for (const p of pages) await expect(cell(p, 0)).toHaveAttribute('data-state', 'queen')
    await guests[1].getByRole('button', { name: '復原', exact: true }).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'empty')
    await guests[1].getByRole('button', { name: '指示格子', exact: true }).click()
    await cell(guests[1], 7).click()
    for (const p of [page, guests[0]]) await expect(cell(p, 7)).toContainText('Charlie')
    await contexts[1].setOffline(true)
    for (const p of [page, guests[0]])
      await expect(p.getByRole('button', { name: '繼續合作', exact: true })).toBeDisabled({
        timeout: 25000,
      })
    await contexts[1].setOffline(false)
    await expect(page.getByRole('button', { name: '繼續合作', exact: true })).toBeEnabled({
      timeout: 20000,
    })
    await page.getByRole('button', { name: '繼續合作', exact: true }).click()
    for (const p of pages) await expect(p.getByRole('grid')).toBeVisible()
    const regions = await page.getByRole('gridcell').evaluateAll((elements) => {
      const cells = elements.map((e) => Number(e.getAttribute('data-region')))
      return Array.from({ length: 6 }, (_, r) => cells.slice(r * 6, r * 6 + 6))
    })
    for (const [row, col] of solve(regions).solutions[0].entries()) {
      await cell(pages[row % pages.length], row * 6 + col).click()
      for (const p of pages)
        await expect(cell(p, row * 6 + col)).toHaveAttribute('data-state', 'queen')
    }
    for (const p of pages) {
      await expect(p.getByRole('heading', { name: '關卡完成' })).toBeVisible()
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: '開啟下一局 →' }).click()
    for (const p of pages) await expect(p.getByRole('heading', { name: /等待室/ })).toBeVisible()
    await page.getByRole('button', { name: '離開', exact: true }).click()
    await expect(guests[0].getByRole('button', { name: '開始合作', exact: true })).toBeVisible()
    await expect(guests[0].locator('.player-row')).toHaveCount(2)
    expect(errors).toEqual([])
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
