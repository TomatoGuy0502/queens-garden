import { test, expect, type Page } from '@playwright/test'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const language = (page: Page) => page.getByRole('combobox', { name: /語言|Language|言語/ })

test.describe('browser language detection', () => {
  test.describe('Japanese browser', () => {
    test.use({ locale: 'ja-JP' })
    test('starts in Japanese and tells the document so', async ({ page }) => {
      await page.goto('/')
      await expect(heading(page)).toHaveText('Queens パズル')
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
      await expect(page).toHaveTitle('Queens · パズル')
      await expect(page.getByRole('link', { name: 'ひとりで', exact: true })).toBeVisible()
      await expect(language(page)).toHaveValue('ja')
    })
  })
  test.describe('Traditional Chinese browser', () => {
    test.use({ locale: 'zh-TW' })
    test('starts in Traditional Chinese', async ({ page }) => {
      await page.goto('/')
      await expect(heading(page)).toHaveText('Queens 益智遊戲')
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    })
  })
  test.describe('unsupported browser language', () => {
    test.use({ locale: 'fr-FR' })
    test('falls back to English', async ({ page }) => {
      await page.goto('/')
      await expect(heading(page)).toHaveText('Queens Puzzle')
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    })
  })
})

test('the chosen language is remembered, applied to the page and synced between tabs', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(heading(page)).toHaveText('Queens 益智遊戲')
  await language(page).selectOption('en')
  await expect(heading(page)).toHaveText('Queens Puzzle')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page).toHaveTitle('Queens · Puzzle')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /one crown/)
  await page.getByRole('link', { name: 'Tutorial', exact: true }).click()
  await expect(language(page)).toHaveValue('en')
  await page.reload()
  await expect(language(page)).toHaveValue('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.goto('/')

  const other = await context.newPage()
  try {
    await other.goto('/')
    await expect(heading(other)).toHaveText('Queens Puzzle')
    await language(other).selectOption('ja')
    await expect(heading(page)).toHaveText('Queens パズル')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  } finally {
    await other.close()
  }
})
test('switching language keeps working when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await page.goto('/')
  await language(page).selectOption('en')
  await expect(heading(page)).toHaveText('Queens Puzzle')
  await page.getByRole('link', { name: 'Co-op', exact: true }).click()
  await expect(language(page)).toHaveValue('en')
})

test.describe('solo game screens', () => {
  test('are translated, including board labels, dialogs and the stats page', async ({ page }) => {
    await page.goto('/solo?size=6&difficulty=easy&seed=42')
    await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
    await language(page).selectOption('en')
    await expect(page.getByRole('heading', { name: 'Game settings' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check for mistakes' })).toBeVisible()
    await expect(page.locator('.puzzle-meta')).toContainText('Easy')
    await expect(page.getByRole('gridcell').first()).toHaveAttribute(
      'aria-label',
      /^Row 1, column 1, region [A-F], empty$/,
    )
    await page.getByRole('gridcell').first().click()
    await expect(page.getByRole('gridcell').first()).toHaveAttribute(
      'aria-label',
      /^Row 1, column 1, region [A-F], crown$/,
    )
    await page.getByRole('button', { name: 'Share puzzle' }).click()
    await expect(page.getByRole('dialog', { name: 'Share puzzle' })).toBeVisible()
    await page.getByRole('button', { name: 'Close share' }).click()

    await language(page).selectOption('ja')
    await expect(page.getByRole('heading', { name: 'ゲーム設定' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ヒントをください' })).toBeVisible()
    await expect(page.getByRole('gridcell').first()).toHaveAttribute(
      'aria-label',
      /^1 行目、1 列目、領域 [A-F]、クラウン$/,
    )

    await page.getByRole('link', { name: '成績', exact: true }).click()
    await expect(page.getByRole('heading', { name: '成績', level: 1 })).toBeVisible()
    await expect(page.getByText('まだ記録がありません')).toBeVisible()
    await page.goto('/missing')
    await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()
  })
})
