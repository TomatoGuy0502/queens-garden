import { test, expect, type Browser, type Page, type WebSocketRoute } from '@playwright/test'
import { solve } from '../src/queens/solver'
const cell = (page: Page, index: number) => page.locator(`[data-index="${index}"]`)
// One click marks a cell with an X and a second click turns it into a queen. In a room each click
// is confirmed by the server before the next one counts, so wait for the first before the second.
async function queen(page: Page, i: number) {
  await cell(page, i).click()
  await expect(cell(page, i)).toHaveAttribute('data-state', 'marked')
  await cell(page, i).click()
  await expect(cell(page, i)).toHaveAttribute('data-state', 'queen')
}
// Leaving a joined room asks for confirmation; ordinary flows simply agree to it.
const acceptDialogs = (page: Page) => page.on('dialog', (dialog) => void dialog.accept())
test.beforeEach(({ page }) => acceptDialogs(page))
async function pair(
  host: Page,
  browser: Browser,
  mobile: boolean,
  prepare?: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 720 },
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'zh-TW',
  })
  const guest = await context.newPage()
  acceptDialogs(guest)
  if (prepare) {
    await prepare(host)
    await prepare(guest)
  }
  await host.goto('/rooms/new')
  await host.getByLabel('你的暱稱').fill('Alice')
  await host.getByLabel('棋盤大小').selectOption('6')
  await host.getByRole('button', { name: '建立房間', exact: true }).click()
  await expect(host).toHaveURL(/\/rooms\/[A-Z0-9]{5}$/)
  await expect(host.getByRole('heading', { name: /等待室/ })).toBeVisible()
  await guest.goto(host.url())
  await guest.getByLabel('你的暱稱').fill('Bob')
  await guest.getByRole('button', { name: '加入房間', exact: true }).click()
  await expect(guest.getByRole('heading', { name: /等待室/ })).toBeVisible()
  await expect(host.locator('.player-row')).toHaveCount(2)
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
    await guest.getByRole('switch', { name: '深色模式', exact: true }).check()
    await expect(guest.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const hostBefore = (await page.locator('.board-stage').boundingBox())!
    const guestBefore = (await guest.locator('.board-stage').boundingBox())!
    await page.getByRole('button', { name: '遊玩設定', exact: true }).click()
    const hostSettings = page.getByRole('dialog', { name: '遊玩設定', exact: true })
    await hostSettings.getByRole('switch', { name: '放大棋盤', exact: true }).check()
    await hostSettings.getByRole('button', { name: '關閉設定', exact: true }).click()
    const hostBoard = (await page.locator('.board-stage').boundingBox())!
    const operations = (await page.locator('.coop-aside').boundingBox())!
    expect(operations.y).toBeGreaterThan(hostBoard.y + hostBoard.height)
    if (!isMobile) expect(hostBoard.width).toBeGreaterThan(hostBefore.width * 1.5)
    expect((await guest.locator('.board-stage').boundingBox())!.width).toBeCloseTo(
      guestBefore.width,
      0,
    )
    await page.getByRole('button', { name: '邀請朋友', exact: true }).click()
    const invite = page.getByRole('dialog', { name: '邀請朋友' })
    expect(await invite.getByLabel('房間連結').inputValue()).toBe(page.url())
    await expect(invite.getByRole('img', { name: '房間 QR Code' })).toBeVisible()
    await invite.getByRole('button', { name: '關閉分享' }).click()
    await cell(page, 0).click()
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'marked')
    await cell(guest, 0).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
    await expect(page.getByRole('button', { name: '復原', exact: true })).toBeDisabled()
    await guest.getByRole('button', { name: '復原', exact: true }).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked')
    await guest.getByRole('button', { name: '重做', exact: true }).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
    await page.getByRole('button', { name: '指示格子', exact: true }).click()
    await expect(page.getByRole('button', { name: '結束指示', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await cell(page, 7).click()
    await expect(cell(guest, 7)).toHaveAttribute('data-pointed', 'true')
    await expect(cell(guest, 7)).toContainText('Alice')
    await expect(cell(guest, 7)).toHaveAttribute('data-state', 'empty')
    // Pointing stays on, so another cell can be shown without switching it on again. The server
    // drops pointers sent closer than 250ms apart, so wait past that like a real second tap.
    await page.waitForTimeout(300)
    await cell(page, 8).click()
    await expect(cell(guest, 8)).toHaveAttribute('data-pointed', 'true')
    await expect(cell(guest, 8)).toHaveAttribute('data-state', 'empty')
    await page.getByRole('button', { name: '結束指示', exact: true }).click()
    await expect(page.getByRole('button', { name: '指示格子', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // Clear our shared mark, then request a safe explanatory team hint.
    await cell(page, 0).click()
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'empty')
    await page.getByRole('button', { name: '給我一點提示', exact: true }).click()
    await page.getByRole('button', { name: '再多一點提示', exact: true }).click()
    await page.getByRole('button', { name: '告訴我答案', exact: true }).click()
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
      await queen(actor, row * 6 + col)
      await expect(cell(row % 2 ? page : guest, row * 6 + col)).toHaveAttribute(
        'data-state',
        'queen',
      )
    }
    await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
    await expect(guest.getByRole('heading', { name: '關卡完成' })).toBeVisible()
    await expect(guest.getByRole('button', { name: '等待房主開啟下一局' })).toBeDisabled()
    await expect(guest.getByRole('button', { name: '查看棋盤', exact: true })).toBeFocused()
    const summary = await page.locator('.result').innerText()
    const finishedCells = await page
      .getByRole('gridcell')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-state')))
    const time = await page.locator('.coop-meta > div:last-child > span').innerText()
    await page.getByRole('button', { name: '查看棋盤', exact: true }).click()
    await expect(page.getByRole('heading', { name: '關卡完成' })).not.toBeVisible()
    await expect(guest.getByRole('heading', { name: '關卡完成' })).toBeVisible()
    await expect(page.getByRole('grid')).toHaveAttribute('aria-readonly', 'true')
    await cell(page, 0).click()
    await cell(page, 0).press('x')
    await cell(page, 0).press('Enter')
    await page.waitForTimeout(1100)
    await expect(page.locator('.coop-meta > div:last-child > span')).toHaveText(time)
    expect(
      await page
        .getByRole('gridcell')
        .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-state'))),
    ).toEqual(finishedCells)
    await page.getByRole('button', { name: '返回完成摘要' }).click()
    await expect(page.locator('.result')).toHaveText(summary, { useInnerText: true })
    await guest.getByRole('button', { name: '查看棋盤', exact: true }).click()
    await expect(guest.getByRole('button', { name: '返回完成摘要' })).toBeInViewport({ ratio: 1 })
    await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
    await page.getByRole('button', { name: '開啟下一局 →' }).click()
    await expect(page.getByRole('heading', { name: /等待室/ })).toBeVisible()
    await expect(guest.getByRole('heading', { name: /等待室/ })).toBeVisible()
    await expect(guest.getByRole('button', { name: '返回完成摘要' })).not.toBeVisible()
    expect(errors).toEqual([])
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    )
  } finally {
    await context.close()
  }
})

test('guest disconnect, reconnect and explicit leaving do not interrupt the host board or clock', async ({
  page,
  browser,
  isMobile,
}) => {
  const { guest, context } = await pair(page, browser, isMobile)
  try {
    await queen(page, 0)
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'queen')
    await context.setOffline(true)
    await expect(page.locator('.presence-bar')).toContainText('離線', { timeout: 25000 })
    await expect(page.getByRole('grid')).toBeVisible()
    await expect(page.getByRole('button', { name: '暫停合作', exact: true })).toBeEnabled()
    const time = await page.locator('.coop-meta > div:last-child > span').innerText()
    await queen(page, 1)
    await expect(page.locator('.coop-meta > div:last-child > span')).not.toHaveText(time)
    await page.getByRole('button', { name: '暫停合作', exact: true }).click()
    await expect(page.getByRole('button', { name: '繼續合作', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '繼續合作', exact: true }).click()
    await context.setOffline(false)
    await expect(guest.getByRole('grid')).toBeVisible()
    await expect(cell(guest, 1)).toHaveAttribute('data-state', 'queen')
    await guest.reload()
    await expect(guest.locator('.presence-bar')).toContainText('Bob（你）')
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'queen')
    await guest.getByRole('button', { name: '離開', exact: true }).click()
    await expect(page.locator('.presence-bar > span')).toHaveCount(1)
    await expect(page.getByRole('grid')).toBeVisible()
    await queen(page, 2)
    await page.getByRole('button', { name: '給我一點提示', exact: true }).click()
    await expect(page.locator('.coop-feedback')).toContainText('衝突')
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
  await page.getByRole('link', { name: '多人模式', exact: true }).click()
  await page.getByRole('link', { name: /^多人合作/ }).click()
  await expect(page.getByRole('heading', { name: '建立房間' })).toBeVisible()
  await page.getByRole('link', { name: '單人遊戲', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await queen(page, 0)
  await expect(page.locator('.timer > span')).not.toHaveText('00:00')
})

test('three players join freely, synchronize edits and pointers, reconnect and finish together', async ({
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
        locale: 'zh-TW',
      }),
    ),
  )
  const guests = await Promise.all(contexts.map((context) => context.newPage()))
  guests.forEach(acceptDialogs)
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
    await expect(page.getByRole('button', { name: '開始合作', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '開始合作', exact: true }).click()
    for (const p of pages) await expect(p.getByRole('grid')).toBeVisible({ timeout: 30000 })
    await queen(guests[1], 0)
    for (const p of pages) await expect(cell(p, 0)).toHaveAttribute('data-state', 'queen')
    await guests[1].getByRole('button', { name: '復原', exact: true }).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked')
    // Undo only reverses the latest edit; the earlier X is cleared by cycling the cell round.
    await cell(guests[1], 0).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'queen')
    await cell(guests[1], 0).click()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'empty')
    await guests[1].getByRole('button', { name: '指示格子', exact: true }).click()
    await cell(guests[1], 7).click()
    for (const p of [page, guests[0]]) await expect(cell(p, 7)).toContainText('Charlie')
    await guests[1].getByRole('button', { name: '結束指示', exact: true }).click()
    await contexts[1].setOffline(true)
    for (const p of [page, guests[0]]) {
      await expect(p.locator('.presence-bar')).toContainText('離線', { timeout: 25000 })
      await expect(p.getByRole('grid')).toBeVisible()
    }
    await contexts[1].setOffline(false)
    for (const p of pages) await expect(p.getByRole('grid')).toBeVisible()
    const regions = await page.getByRole('gridcell').evaluateAll((elements) => {
      const cells = elements.map((e) => Number(e.getAttribute('data-region')))
      return Array.from({ length: 6 }, (_, r) => cells.slice(r * 6, r * 6 + 6))
    })
    for (const [row, col] of solve(regions).solutions[0].entries()) {
      await queen(pages[row % pages.length], row * 6 + col)
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

test('five room-code boxes support typing, keyboard and pasting links; nicknames survive reload', async ({
  page,
}) => {
  await page.goto('/rooms/new')
  await page.getByLabel('你的暱稱').fill('Remember Me')
  await page.reload()
  await expect(page.getByLabel('你的暱稱')).toHaveValue('Remember Me')
  await page.getByRole('button', { name: '建立房間', exact: true }).click()
  await expect(page).toHaveURL(/\/rooms\/[A-Z0-9]{5}$/)
  const url = page.url(),
    code = url.split('/').at(-1)!
  await expect(page.getByRole('button', { name: '準備好了', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '開始合作', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '離開', exact: true }).click()
  await page.goto('/rooms/new')
  await expect(page.getByLabel('你的暱稱')).toHaveValue('Remember Me')
  const digit = (i: number) => page.getByLabel(`房間代碼第 ${i} 碼`, { exact: true })
  await expect(page.locator('.code-digits input')).toHaveCount(5)
  await digit(1).fill('a')
  await expect(digit(1)).toHaveValue('A')
  await expect(digit(2)).toBeFocused()
  await digit(2).fill('!')
  await expect(digit(2)).toHaveValue('')
  await digit(2).press('Backspace')
  await expect(digit(1)).toHaveValue('')
  await expect(digit(1)).toBeFocused()
  await digit(1).evaluate((element, text) => {
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', text)
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }),
    )
  }, url.toLowerCase())
  for (let i = 0; i < 5; i++) await expect(digit(i + 1)).toHaveValue(code[i])
  await page.getByRole('button', { name: '前往房間', exact: true }).click()
  await expect(page.getByLabel('你的暱稱')).toHaveValue('Remember Me')
  await page.getByRole('button', { name: '加入房間', exact: true }).click()
  await expect(page.getByRole('heading', { name: /等待室/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/rooms/abcdef123456')
  await expect(page.getByRole('heading', { name: '找不到這個頁面' })).toBeVisible()
  expect(
    (await page.request.post('/api/rooms/abcdef123456/join', { data: { name: 'Old' } })).status(),
  ).toBe(400)
})
test('cooperative nickname input remains usable when localStorage is unavailable and late joining does not pause', async ({
  page,
  browser,
  isMobile,
}) => {
  await page.addInitScript(() => {
    const get = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!.value as (
      this: Storage,
      key: string,
    ) => string | null
    const set = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value as (
      this: Storage,
      key: string,
      value: string,
    ) => void
    Storage.prototype.getItem = function (key) {
      if (key === 'queens:player-name') throw new DOMException('Denied', 'SecurityError')
      return get.call(this, key)
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'queens:player-name') throw new DOMException('Denied', 'SecurityError')
      set.call(this, key, value)
    }
  })
  const context = await browser.newContext({
    viewport: isMobile ? { width: 393, height: 851 } : { width: 1280, height: 720 },
    isMobile,
    hasTouch: isMobile,
    locale: 'zh-TW',
  })
  try {
    await page.goto('/rooms/new')
    await page.getByLabel('你的暱稱').fill('Host without storage')
    await page.getByLabel('棋盤大小').selectOption('6')
    await page.getByRole('button', { name: '建立房間', exact: true }).click()
    await page.getByRole('button', { name: '開始合作', exact: true }).click()
    await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
    await queen(page, 0)
    const guest = await context.newPage()
    acceptDialogs(guest)
    await guest.goto(page.url())
    await guest.getByLabel('你的暱稱').fill('Late guest')
    await guest.getByRole('button', { name: '加入房間', exact: true }).click()
    await expect(guest.getByRole('grid')).toBeVisible()
    await expect(page.getByRole('grid')).toBeVisible()
    await expect(cell(guest, 0)).toHaveAttribute('data-state', 'queen')
    await page.getByRole('button', { name: '離開', exact: true }).click()
    await expect(guest.locator('.presence-bar > span')).toHaveCount(1)
    await queen(guest, 1)
  } finally {
    await context.close()
  }
})

test('simultaneous edits show dismissible toasts without moving the board, including repeated conflicts', async ({
  page,
  browser,
  isMobile,
}) => {
  let hold = true
  let queued: { server: WebSocketRoute; message: string | Buffer }[] = []
  const prepare = (p: Page) =>
    p.routeWebSocket('**/socket.io/**', (route) => {
      const server = route.connectToServer()
      route.onMessage((message) => {
        if (
          hold &&
          typeof message === 'string' &&
          message.includes('"room:command"') &&
          message.includes('"setCell"')
        ) {
          queued.push({ server, message })
          if (queued.length === 2) {
            hold = false
            for (const item of queued) item.server.send(item.message)
            queued = []
          }
        } else server.send(message)
      })
    })
  const { guest, context } = await pair(page, browser, isMobile, prepare)
  // The lobby may have scrolled while starting; measure the board from the top of the page.
  await Promise.all([page, guest].map((p) => p.evaluate(() => scrollTo(0, 0))))
  const boards = await Promise.all([page, guest].map((p) => p.getByRole('grid').boundingBox()))
  try {
    for (const index of [0, 1]) {
      hold = true
      await Promise.all([cell(page, index).click(), cell(guest, index).click()])
      await expect
        .poll(
          async () =>
            (await page.locator('.room-toast').count()) +
            (await guest.locator('.room-toast').count()),
        )
        .toBe(1)
      const loser = (await page.locator('.room-toast').count()) ? page : guest
      await expect(loser.locator('.room-toast')).toContainText('已被其他操作更新')
      await expect(loser.locator('.toast-host')).toHaveCSS('position', 'fixed')
      for (const [i, p] of [page, guest].entries()) {
        expect((await p.getByRole('grid').boundingBox())?.y).toBeCloseTo(boards[i]!.y, 1)
        await expect(p.locator('.error-notice')).toHaveCount(0)
      }
      if (index === 0) {
        await loser.getByRole('button', { name: '關閉通知', exact: true }).click()
        await expect(loser.locator('.room-toast')).toHaveCount(0)
      } else {
        await loser.mouse.move(0, 0)
        await expect(loser.locator('.room-toast')).toHaveCount(0, { timeout: 7000 })
      }
    }
  } finally {
    await context.close()
  }
})

test('peer hover and keyboard focus show names and coordinates without edits or layout movement', async ({
  page,
  browser,
  isMobile,
}) => {
  const { guest, context } = await pair(page, browser, isMobile)
  try {
    const y = (await guest.getByRole('grid').boundingBox())!.y
    await cell(page, 7).hover()
    await expect(cell(guest, 7)).toHaveAttribute('data-hovered', 'true')
    await expect(cell(guest, 7)).toContainText('Alice 停留')
    await guest.screenshot({ path: test.info().outputPath('peer-hover.png'), fullPage: true })
    await expect(
      guest.locator('.presence-bar > span').filter({ hasText: 'Alice' }).locator('.hover-position'),
    ).toHaveText('停在 2,2')
    await expect(cell(guest, 7)).toHaveAttribute('data-state', 'empty')
    expect((await guest.getByRole('grid').boundingBox())!.y).toBeCloseTo(y, 1)
    // A stationary pointer stays visible beyond the five-second expiry via its heartbeat.
    await page.waitForTimeout(5500)
    await expect(cell(guest, 7)).toHaveAttribute('data-hovered', 'true')
    await cell(page, 8).hover()
    await expect(cell(guest, 7)).toHaveAttribute('data-hovered', 'false')
    await expect(cell(guest, 8)).toHaveAttribute('data-hovered', 'true')
    await page.mouse.move(0, 0)
    await expect(guest.locator('[data-hovered="true"]')).toHaveCount(0)
    await cell(page, 14).focus()
    await expect(cell(guest, 14)).toHaveAttribute('data-hovered', 'true')
    await cell(page, 14).press('ArrowRight')
    await expect(cell(guest, 15)).toHaveAttribute('data-hovered', 'true')
    await page.getByRole('button', { name: '暫停合作', exact: true }).click()
    await expect(guest.locator('[data-hovered="true"]')).toHaveCount(0)
    await page.getByRole('button', { name: '繼續合作', exact: true }).click()
    await cell(page, 7).hover()
    await expect(cell(guest, 7)).toHaveAttribute('data-hovered', 'true')
    await page.close()
    await expect(guest.locator('[data-hovered="true"]')).toHaveCount(0)
    await expect(guest.getByRole('grid')).toBeVisible()
    await expect(guest.locator('[data-state="queen"]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('host restarts the same shared puzzle with confirmation while guests cannot restart', async ({
  page,
  browser,
  isMobile,
}) => {
  let heldAck: (() => void) | undefined
  const { guest, context } = await pair(page, browser, isMobile, async (p) => {
    if (p === page) return
    await p.routeWebSocket('**/socket.io/**', (route) => {
      const server = route.connectToServer()
      let ackId: string | undefined
      let captured = false
      route.onMessage((message) => {
        if (!captured && typeof message === 'string' && message.includes('"setCell"')) {
          ackId = /^42(\d+)\[/.exec(message)?.[1]
          captured = true
        }
        server.send(message)
      })
      server.onMessage((message) => {
        if (
          ackId !== undefined &&
          typeof message === 'string' &&
          message.startsWith(`43${ackId}[`)
        ) {
          heldAck = () => route.send(message)
          ackId = undefined
        } else route.send(message)
      })
    })
  })
  try {
    const regions = await page
      .getByRole('gridcell')
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-region')))
    const seed = await page.locator('.coop-footer').innerText()
    await expect(guest.getByRole('button', { name: '重新開始', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '給我一點提示', exact: true }).click()
    await page.getByRole('button', { name: '再多一點提示', exact: true }).click()
    await page.getByRole('button', { name: '告訴我答案', exact: true }).click()
    await guest.getByRole('button', { name: '套用這一步 →' }).click()
    await expect(page.locator('[data-state="marked"]')).not.toHaveCount(0)
    await cell(guest, 0).click()
    await expect.poll(() => !!heldAck).toBe(true)
    await page.getByRole('button', { name: '暫停合作', exact: true }).click()
    await page.getByRole('button', { name: '重新開始', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: '重新開始本關？' })
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(page.getByRole('button', { name: '繼續合作', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '重新開始', exact: true }).click()
    dialog = page.getByRole('dialog', { name: '重新開始本關？' })
    await dialog.getByRole('button', { name: '確認重新開始', exact: true }).click()
    for (const p of [page, guest]) {
      await expect(p.getByRole('grid')).toBeVisible()
      await expect(p.locator('[data-state="empty"]')).toHaveCount(36)
      await expect(p.getByRole('button', { name: '復原', exact: true })).toBeDisabled()
      await expect(p.getByRole('button', { name: '重做', exact: true })).toBeDisabled()
      await expect(p.locator('.coop-footer')).toHaveText(seed)
    }
    expect(
      await page
        .getByRole('gridcell')
        .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-region'))),
    ).toEqual(regions)
    await expect(page.locator('.coop-meta > div:last-child > span')).toHaveText('00:00')
    await expect(cell(guest, 0)).toBeEnabled()
    await cell(guest, 0).click()
    heldAck?.()
    await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked')
    await page.getByRole('button', { name: '更換關卡', exact: true }).click()
    await page
      .getByRole('dialog', { name: '更換關卡？' })
      .getByRole('button', { name: '回到等待室', exact: true })
      .click()
    for (const p of [page, guest])
      await expect(p.getByRole('heading', { name: /等待室/ })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('a team hint is revealed in levels that every player sees together', async ({
  page,
  browser,
  isMobile,
}) => {
  const { guest, context } = await pair(page, browser, isMobile)
  try {
    const apply = (who: Page) => who.getByRole('button', { name: '套用這一步 →' })
    await page.getByRole('button', { name: '給我一點提示', exact: true }).click()
    for (const who of [page, guest]) {
      await expect(who.locator('.coop-feedback')).toContainText('邏輯提示 1 / 3', {
        timeout: 15000,
      })
      await expect(who.locator('.coop-feedback')).toContainText('先看看')
      await expect(apply(who)).toHaveCount(0)
    }
    const looking = await guest.locator('.cell.highlighted').count()
    expect(looking).toBeGreaterThan(0)
    // The other player deepens the same hint, and the host sees it follow.
    await guest.getByRole('button', { name: '再多一點提示', exact: true }).click()
    for (const who of [page, guest]) {
      await expect(who.locator('.coop-feedback')).toContainText('邏輯提示 2 / 3')
      await expect(who.locator('.coop-feedback')).toContainText('相鄰排除')
      await expect(apply(who)).toHaveCount(0)
    }
    await page.getByRole('button', { name: '告訴我答案', exact: true }).click()
    for (const who of [page, guest]) {
      await expect(who.locator('.coop-feedback')).toContainText('邏輯提示 3 / 3')
      await expect(apply(who)).toBeVisible()
      await expect(who.getByRole('button', { name: '答案已顯示', exact: true })).toBeDisabled()
    }
    await expect(guest.locator('.cell.highlighted').first()).toBeVisible()
    await cell(page, 0).click()
    for (const who of [page, guest]) {
      await expect(apply(who)).toHaveCount(0)
      await expect(who.locator('.cell.highlighted')).toHaveCount(0)
      await expect(who.getByRole('button', { name: '給我一點提示', exact: true })).toBeEnabled()
    }
  } finally {
    await context.close()
  }
})

test('a joined player is asked to confirm before leaving the room', async ({
  page,
  browser,
  isMobile,
}) => {
  const { guest, context } = await pair(page, browser, isMobile)
  try {
    const seen: string[] = []
    page.removeAllListeners('dialog')
    page.on('dialog', (dialog) => {
      seen.push(`${dialog.type()}:${dialog.message()}`)
      void dialog.dismiss()
    })
    const room = page.url()
    // Declining keeps the player in the room, whichever way they try to leave.
    await page.getByRole('link', { name: '單人遊戲', exact: true }).click()
    await expect.poll(() => seen.length).toBe(1)
    expect(seen[0]).toContain('confirm:確定要離開這個房間嗎')
    await page.getByRole('button', { name: '離開', exact: true }).click()
    await expect.poll(() => seen.length).toBe(2)
    await expect(page).toHaveURL(room)
    await expect(page.getByRole('grid')).toBeVisible()
    // Closing the tab raises the browser's own prompt, and declining keeps the page open.
    const unload = page.waitForEvent('dialog')
    void page.close({ runBeforeUnload: true })
    expect((await unload).type()).toBe('beforeunload')
    expect(page.isClosed()).toBe(false)
    // Agreeing leaves, and the explicit leave button asks only once.
    page.removeAllListeners('dialog')
    const asked: string[] = []
    page.on('dialog', (dialog) => {
      asked.push(dialog.type())
      void dialog.accept()
    })
    await page.getByRole('button', { name: '離開', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    expect(asked).toEqual(['confirm'])
    await expect(guest.locator('.presence-bar > span')).toHaveCount(1)
  } finally {
    await context.close()
  }
})
test('pages outside a joined room never ask before leaving', async ({ page }) => {
  const dialogs: string[] = []
  page.removeAllListeners('dialog')
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.type())
    void dialog.dismiss()
  })
  await page.goto('/rooms/new')
  await page.getByRole('link', { name: '單人遊戲', exact: true }).click()
  await expect(page).toHaveURL(/\/solo/)
  await page.goto('/')
  expect(dialogs).toEqual([])
})

test('a large board scrolls inside its own box instead of widening the phone page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 851 })
  await page.goto('/rooms/new')
  await page.getByLabel('你的暱稱').fill('Alice')
  await page.getByLabel('棋盤大小').selectOption('12')
  await page.getByRole('button', { name: '建立房間', exact: true }).click()
  await page.getByRole('button', { name: '開始合作', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 60000 })
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    view: document.documentElement.clientWidth,
  }))
  expect(widths.page).toBeLessThanOrEqual(widths.view)
})

test('your own tap shows at once, before the server has answered', async ({ page }) => {
  await page.goto('/rooms/new')
  await page.getByLabel('你的暱稱').fill('Alice')
  await page.getByLabel('棋盤大小').selectOption('6')
  await page.getByRole('button', { name: '建立房間', exact: true }).click()
  await page.getByRole('button', { name: '開始合作', exact: true }).click()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
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
  await expect(page.getByRole('grid')).toBeVisible()
  await cell(page, 0).click()
  await expect(cell(page, 0)).toHaveAttribute('data-state', 'marked', { timeout: 500 })
})
