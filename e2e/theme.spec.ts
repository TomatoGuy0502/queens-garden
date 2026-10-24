import { test, expect, type Page } from '@playwright/test'
import jsQR from 'jsqr'
import { solve } from '../src/queens/solver'
import { GENERATOR_VERSION } from '../src/queens/version'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))
const theme = (page: Page) => page.locator('html')
const appearance = (page: Page, name: string) => page.getByRole('radio', { name, exact: true })
async function settings(page: Page) {
  await page.getByRole('button', { name: '遊玩設定', exact: true }).click()
  return page.getByRole('dialog', { name: '遊玩設定', exact: true })
}

test('appearance follows the system, remembers overrides across routes and reloads, and syncs tabs', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
  await expect(appearance(page, '跟隨系統')).toBeChecked()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(theme(page)).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
  await appearance(page, '淺色').check()
  await expect(theme(page)).toHaveAttribute('data-theme', 'light')
  await page.getByRole('link', { name: '多人合作', exact: true }).click()
  await expect(theme(page)).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(appearance(page, '淺色')).toBeChecked()
  const other = await context.newPage()
  try {
    await other.goto('/')
    await appearance(other, '深色').check()
    await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
    await expect(appearance(page, '深色')).toBeChecked()
    await other.evaluate(() => localStorage.removeItem('queens:theme:v1'))
    await expect(appearance(page, '跟隨系統')).toBeChecked()
    await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(theme(page)).toHaveAttribute('data-theme', 'light')
  } finally {
    await other.close()
  }
})

test('dark board preserves play, guidance, QR sharing, completion and read-only review', async ({
  page,
}) => {
  await page.goto(`/?size=6&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(36)
  const regions = await page.getByRole('gridcell').evaluateAll((cells) => {
    const flat = cells.map((cell) => Number(cell.getAttribute('data-region')))
    return Array.from({ length: 6 }, (_, row) => flat.slice(row * 6, row * 6 + 6))
  })
  const solution = solve(regions).solutions[0]
  const first = page.locator(`[data-index="${solution[0]}"]`)
  const lightColor = await first.evaluate((cell) => getComputedStyle(cell).backgroundColor)
  await first.click()
  await appearance(page, '深色').check()
  const dialog = await settings(page)
  await dialog.getByRole('switch', { name: '顯示皇冠排除範圍' }).check()
  await dialog.getByRole('button', { name: '完成', exact: true }).click()
  await expect(first).toHaveAttribute('data-state', 'queen')
  expect(await first.evaluate((cell) => getComputedStyle(cell).backgroundColor)).not.toBe(
    lightColor,
  )
  await expect(page.locator('[data-guided="true"]').first()).toBeVisible()
  expect(
    await page
      .locator('[data-guided="true"]')
      .first()
      .evaluate((cell) => getComputedStyle(cell).backgroundImage),
  ).toContain('repeating-linear-gradient')
  // Verify all twelve region palettes keep the crown readable, including 12×12 boards.
  const contrasts = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    const luminance = (hex: string) => {
      const values = hex
        .trim()
        .slice(1)
        .match(/../g)!
        .map((part) => {
          const channel = parseInt(part, 16) / 255
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        })
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
    }
    const ink = luminance(style.getPropertyValue('--cell-ink'))
    return Array.from(
      { length: 12 },
      (_, i) => (ink + 0.05) / (luminance(style.getPropertyValue(`--region-${i}`)) + 0.05),
    )
  })
  expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5)
  await page.getByRole('button', { name: '暫停遊戲', exact: true }).click()
  await expect(page.getByRole('grid')).not.toBeVisible()
  await page.getByRole('button', { name: '繼續遊戲', exact: true }).last().click()
  await page.getByRole('button', { name: '分享關卡', exact: true }).click()
  const share = page.getByRole('dialog', { name: '分享關卡' })
  const link = await share.getByLabel('關卡連結').inputValue()
  const pixels = await share.getByRole('img', { name: '關卡 QR Code' }).evaluate(async (svg) => {
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('QR image load failed'))
    })
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 224
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0, 224, 224)
    return Array.from(context.getImageData(0, 0, 224, 224).data)
  })
  expect(jsQR(new Uint8ClampedArray(pixels), 224, 224)?.data).toBe(link)
  await share.getByRole('button', { name: '關閉分享' }).click()
  for (let row = 1; row < 6; row++)
    await page.locator(`[data-index="${row * 6 + solution[row]}"]`).click()
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeInViewport({ ratio: 1 })
  await page.getByRole('button', { name: '查看棋盤', exact: true }).click()
  await expect(page.getByRole('grid')).toHaveAttribute('aria-readonly', 'true')
  await expect(page.getByRole('button', { name: '返回完成摘要' })).toBeInViewport({ ratio: 1 })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
})

test('stored dark appearance is applied before the Vue bundle runs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('queens:theme:v1', 'dark'))
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/assets/*.js', async (route) => {
    await waiting
    await route.continue()
  })
  try {
    await page.goto('/', { waitUntil: 'commit' })
    await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
    await expect(theme(page)).toHaveCSS('background-color', 'rgb(28, 26, 32)')
    await expect(page.locator('#app')).toBeEmpty()
  } finally {
    release()
  }
  await expect(page.getByRole('heading', { name: 'Queens 益智遊戲' })).toBeVisible()
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1c1a20')
})

test('unavailable storage keeps appearance usable for the current session', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        throw new Error('Storage blocked')
      },
    })
  })
  await page.goto('/')
  await appearance(page, '深色').check()
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('radiogroup', { name: '外觀' })).toContainText('無法儲存')
  await page.getByRole('link', { name: '多人合作', exact: true }).click()
  await expect(theme(page)).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(theme(page)).toHaveAttribute('data-theme', 'light')
})
