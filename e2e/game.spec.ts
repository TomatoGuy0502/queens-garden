import jsQR from 'jsqr'
import { test, expect } from '@playwright/test'
import { GENERATOR_VERSION } from '../src/queens/version'
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
  await page.goto(`/?size=6&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
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
  await expect(page.getByText('關卡完成')).not.toBeVisible()
  await expect(page.locator('.cell.mistake')).toHaveCount(6)
  for (let i = 0; i < 6; i++) {
    await cell(page, i).click()
    await cell(page, i).click()
  }
  const regions = await readRegions(page)
  const result = solve(regions)
  expect(result.solutionCount).toBe(1)
  for (const [r, c] of result.solutions[0].entries()) await cell(page, r * 6 + c).click()
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
  await expect(page.getByText(/次操作 · 0 次提示/)).toBeVisible()
  const resultOverlay = page.locator('.board-stage .result')
  await expect(resultOverlay).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: '再來一局 →' })).toBeFocused()
  const boardBox = (await page.locator('.board-stage').boundingBox())!
  const resultBox = (await resultOverlay.boundingBox())!
  expect(resultBox.y).toBeGreaterThanOrEqual(boardBox.y)
  expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(boardBox.y + boardBox.height)
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await expect(page.getByRole('heading', { name: '關卡完成' })).not.toBeVisible()
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(resultOverlay).toBeInViewport({ ratio: 1 })
  const completedUrl = page.url()
  await page.getByRole('button', { name: '再來一局 →' }).click()
  await expect(page).not.toHaveURL(completedUrl)
  await expect(page.locator('[data-state="empty"]')).toHaveCount(36)
  await expect(resultOverlay).not.toBeVisible()
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
  await expect(page.locator('.feedback')).toContainText('相鄰')
  await page.getByRole('button', { name: '套用這一步 →' }).click()
  await expect(page.locator('[data-state="marked"]')).not.toHaveCount(0)
  await page.getByRole('button', { name: '檢查錯誤', exact: true }).click()
  await expect(page.locator('.feedback')).toContainText('都正確')
})
test('explicit seed loading reproduces a puzzle and survives reload', async ({ page }) => {
  await start(page)
  const oldRegions = await readRegions(page)
  await page.getByLabel('關卡種子').fill('1')
  await page.getByRole('button', { name: '載入此種子', exact: true }).click()
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
  await page.getByRole('button', { name: '載入此種子', exact: true }).click()
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
  await page.goto(`/?size=12&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(144, { timeout: 30000 })
  expect((await cell(page, 0).boundingBox())!.width).toBeGreaterThanOrEqual(40)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await cell(page, 143).click()
  await expect(cell(page, 143)).toHaveAttribute('data-state', 'queen')
  const solution = solve(await readRegions(page)).solutions[0]
  if (solution[11] !== 11) {
    await cell(page, 143).click()
    await cell(page, 143).click()
  }
  for (const [row, col] of solution.entries()) {
    if (row === 11 && col === 11) continue
    await cell(page, row * 12 + col).click()
  }
  await expect(page.locator('.board-stage .result')).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('new game automatically changes the seed and keeps the displayed seed in sync', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let next = 1
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (array: Uint32Array) => {
        array[0] = next++
        return array
      },
    })
  })
  await start(page)
  const original = await readRegions(page)
  await page.getByRole('button', { name: '開始新遊戲', exact: true }).click()
  await expect(page).toHaveURL(/seed=1&/)
  await expect(page.getByRole('grid')).toBeVisible()
  await expect(page.getByLabel('關卡種子')).toHaveValue('1')
  expect(await readRegions(page)).not.toEqual(original)
  await page.getByRole('button', { name: '開始新遊戲', exact: true }).click()
  await expect(page).toHaveURL(/seed=2&/)
  await expect(page.getByRole('grid')).toBeVisible()
  await expect(page.getByLabel('關卡種子')).toHaveValue('2')
})

test('sharing copies the active puzzle, renders a decodable QR and reopens the same board', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          document.documentElement.dataset.copiedLink = text
          return Promise.resolve()
        },
      },
    })
    Object.defineProperty(navigator, 'share', {
      value: (data: ShareData) => {
        document.documentElement.dataset.sharedLink = data.url
        return Promise.resolve()
      },
    })
  })
  await start(page)
  const regions = await readRegions(page)
  const hintButton = await page.locator('.assist-tools button').first().boundingBox()
  const footer = await page.locator('.puzzle-footer').boundingBox()
  expect(footer!.y - hintButton!.y - hintButton!.height).toBeGreaterThanOrEqual(20)
  // Unsaved form edits must not alter the shared puzzle.
  await page.getByLabel('關卡種子').fill('777')
  await page.getByRole('button', { name: '分享關卡', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '分享關卡' })
  await expect(dialog).toBeVisible()
  const link = await dialog.getByLabel('關卡連結').inputValue()
  expect(new URL(link).searchParams.get('seed')).toBe('42')
  expect(new URL(link).searchParams.get('v')).toBe(GENERATOR_VERSION)
  const pixels = await dialog.getByRole('img', { name: '關卡 QR Code' }).evaluate(async (svg) => {
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('QR image load failed'))
    })
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 224
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0, 224, 224)
    return Array.from(context.getImageData(0, 0, 224, 224).data)
  })
  expect(jsQR(new Uint8ClampedArray(pixels), 224, 224)?.data).toBe(link)
  await dialog.getByRole('button', { name: '複製連結', exact: true }).click()
  await expect(dialog.getByRole('status')).toHaveText('已複製關卡連結。')
  expect(await page.locator('html').getAttribute('data-copied-link')).toBe(link)
  await dialog.getByRole('button', { name: '系統分享', exact: true }).click()
  expect(await page.locator('html').getAttribute('data-shared-link')).toBe(link)
  await dialog.getByRole('button', { name: '關閉分享', exact: true }).click()
  await expect(page.getByRole('button', { name: '分享關卡', exact: true })).toBeFocused()
  await page.goto(link)
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  expect(await readRegions(page)).toEqual(regions)
})

test('sharing allows manual copying when clipboard access is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
    })
  })
  await start(page)
  await page.getByRole('button', { name: '分享關卡', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '分享關卡' })
  await dialog.getByRole('button', { name: '複製連結', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('請複製已選取的連結')
  await expect(dialog.getByLabel('關卡連結')).toBeFocused()
  expect(
    await dialog
      .getByLabel('關卡連結')
      .evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!),
  ).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('visual guidance is configurable, preserves marks, tracks undo and persists across reload', async ({
  page,
}) => {
  await start(page)
  await cell(page, 14).click()
  await cell(page, 7).click()
  await cell(page, 7).click()
  const originalColor = await cell(page, 12).evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  await expect(page.locator('[data-guided="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: '遊玩設定', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '遊玩設定' })
  await expect(dialog.getByRole('switch', { name: '顯示皇冠排除範圍' })).not.toBeChecked()
  await dialog.getByRole('switch', { name: '顯示皇冠排除範圍' }).check()
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
  await expect(cell(page, 14)).toHaveAttribute('data-guided', 'false')
  await expect(cell(page, 12)).toHaveAttribute('data-guided', 'true')
  await expect(cell(page, 7)).toHaveAttribute('data-state', 'marked')
  expect(
    await cell(page, 12).evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(originalColor)
  expect(
    await cell(page, 12).evaluate((element) => getComputedStyle(element).backgroundImage),
  ).toContain('linear-gradient')
  await expect(cell(page, 12)).toHaveAccessibleName(/皇冠排除範圍/)
  await page.getByRole('button', { name: '遊玩設定', exact: true }).click()
  for (const name of ['同一欄', '同一色區', '周圍八格'])
    await dialog.getByRole('checkbox', { name, exact: true }).uncheck()
  await page.keyboard.press('Escape')
  const guided = () =>
    page
      .locator('[data-guided="true"]')
      .evaluateAll((elements) =>
        elements.map((element) => Number(element.getAttribute('data-index'))),
      )
  expect(await guided()).toEqual([12, 13, 15, 16, 17])
  await cell(page, 14).click()
  await expect(page.locator('[data-guided="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: '復原', exact: true }).click()
  expect(await guided()).toEqual([12, 13, 15, 16, 17])
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(page.locator('[data-guided="true"]')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
  await cell(page, 14).click()
  expect(await guided()).toEqual([12, 13, 15, 16, 17])
  await page.getByRole('button', { name: '遊玩設定', exact: true }).click()
  await expect(dialog.getByRole('switch', { name: '顯示皇冠排除範圍' })).toBeChecked()
  await dialog.getByRole('switch', { name: '顯示皇冠排除範圍' }).uncheck()
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.locator('[data-guided="true"]')).toHaveCount(0)
  await expect(cell(page, 14)).toHaveAttribute('data-state', 'queen')
})

test('visual guidance still works when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Denied', 'SecurityError')
      },
    })
  })
  await start(page)
  await cell(page, 14).click()
  await page.getByRole('button', { name: '遊玩設定', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '遊玩設定' })
  await dialog.getByRole('switch', { name: '顯示皇冠排除範圍' }).check()
  await expect(dialog.getByRole('status')).toContainText('本次遊戲仍會套用')
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
  await expect(cell(page, 12)).toHaveAttribute('data-guided', 'true')
})
