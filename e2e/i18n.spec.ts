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
  await page.getByRole('link', { name: 'Multiplayer', exact: true }).click()
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
      /^Row 1, column 1, region [A-F], X mark$/,
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

test.describe('co-op screens', () => {
  test('are translated from creating a room to the lobby', async ({ page }) => {
    await page.goto('/rooms/new')
    await language(page).selectOption('en')
    await expect(page.getByRole('heading', { name: 'Create a room' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Room code' })).toBeVisible()
    await expect(page.getByLabel('Room code, character 1')).toBeVisible()
    await page.getByLabel('Your nickname').fill('Alice')
    await page.getByRole('button', { name: 'Create room', exact: true }).click()
    await expect(page).toHaveURL(/\/rooms\/[A-Z0-9]{5}$/)
    await expect(page.getByRole('heading', { name: /Lobby/ })).toBeVisible()
    await page.getByLabel('Board size').selectOption('6')
    await expect(page.getByRole('radio', { name: 'Classic (2D)' })).toBeChecked()
    await expect(page.locator('.player-count')).toHaveText('1 / 8 players')
    await expect(page.locator('.player-row')).toContainText('Alice (you)')
    await expect(page.locator('.player-row')).toContainText('Host')
    await language(page).selectOption('ja')
    await expect(page.getByRole('heading', { name: /ロビー/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '協力プレイを始める' })).toBeVisible()
    await page.getByRole('button', { name: '協力プレイを始める' }).click()
    await expect(page.getByRole('grid')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('button', { name: 'ヒントをください' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'マスを指し示す' })).toBeVisible()
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('退出しますか')
      void dialog.accept()
    })
    await page.getByRole('button', { name: '退出' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('hints and lessons', () => {
  test('hint text is translated and follows a language switch', async ({ page }) => {
    await page.goto('/solo?size=6&difficulty=easy&seed=42')
    await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
    await language(page).selectOption('en')
    const feedback = page.locator('.feedback')
    await page.getByRole('button', { name: 'Give me a hint' }).click()
    await expect(feedback).toContainText('Logic hint 1 / 3')
    await expect(feedback).toContainText('Take a look at')
    await page.getByRole('button', { name: 'A bit more' }).click()
    await expect(feedback).toContainText('This step can use')
    await page.getByRole('button', { name: 'Show the answer' }).click()
    await expect(feedback).toContainText('Logic hint 3 / 3')
    await expect(feedback).not.toContainText(/[一-鿿぀-ヿ]/)
    await expect(page.getByRole('button', { name: 'Apply this step →' })).toBeVisible()
    await language(page).selectOption('ja')
    await expect(feedback).toContainText('論理ヒント 3 / 3')
    await expect(feedback).not.toContainText(/[A-Za-z]{6,}/)
  })
  test('the tutorial is translated, including the reasoning shown in lessons', async ({ page }) => {
    await page.goto('/tutorial')
    await language(page).selectOption('en')
    await expect(page.getByRole('heading', { name: 'Tutorial', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'How the game works', level: 2 })).toBeVisible()
    await expect(page.getByText('Lesson 1 / 9')).toBeVisible()
    await language(page).selectOption('ja')
    await expect(page.getByRole('heading', { name: 'ルールを知ろう', level: 2 })).toBeVisible()
    await expect(page.getByText('第 1 / 9 レッスン')).toBeVisible()
  })
})

test('English counts use singular and plural forms', async ({ page }) => {
  await page.goto('/solo?size=6&difficulty=easy&seed=42')
  await expect(page.getByRole('gridcell').first()).toBeVisible({ timeout: 30000 })
  await language(page).selectOption('en')
  await page.getByRole('gridcell').first().click()
  await page.goto('/solo')
  await expect(page.getByText(/· 1 move \(saved/)).toBeVisible()
})
