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
