import { test, expect, type Page } from '@playwright/test'
import { solve3d } from '../src/queens3d/solver'
import { GENERATOR_3D_VERSION } from '../src/queens3d/version'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
  page.on('console', (entry) => {
    if (entry.type() === 'error') messages.push(entry.text())
  })
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

const KEY = 'queens3d:solo-progress:v1'
const N = 5
const link = `/solo3d?size=${N}&difficulty=easy&seed=42&v=${GENERATOR_3D_VERSION}`
const cells = (page: Page) => page.locator('.cell[data-layer]')
/** A cell by layer and index within the layer; a phone shows one layer at a time, picked by tab. */
async function cell(page: Page, z: number, index: number) {
  const tab = page.locator(`[data-tab="${z}"]`)
  if (await tab.isVisible()) await tab.click()
  return page.locator(`[data-layer="${z}"][data-index="${index}"]`)
}
// One click marks a cell with an X and a second click turns it into a crown.
async function queen(page: Page, z: number, index: number) {
  const target = await cell(page, z, index)
  await target.click()
  await target.click()
}
async function open(page: Page) {
  await page.goto(link)
  await expect(cells(page)).toHaveCount(N ** 3, { timeout: 30000 })
}
async function readRegions(page: Page) {
  const flat = await cells(page).evaluateAll((elements) =>
    elements.map((el) => [
      Number(el.getAttribute('data-layer')),
      Number(el.getAttribute('data-region')),
    ]),
  )
  return Array.from({ length: N }, (_, z) =>
    Array.from({ length: N }, (_, r) =>
      Array.from({ length: N }, (_, c) => {
        const [layer, region] = flat[(z * N + r) * N + c]
        expect(layer).toBe(z)
        return z * N + region
      }),
    ),
  )
}

test('a 5×5×5 board can be completed, and two crowns in one pillar are flagged', async ({
  page,
}) => {
  await open(page)
  await expect(page.getByRole('heading', { name: '3D Queens' })).toBeVisible()
  await expect(page.locator('.queen-count')).toContainText('/ 25')
  // Layers sit at most three to a row; a phone shows one, named by its tab instead of a heading.
  const lefts = await page
    .locator('.layer')
    .evaluateAll((els) =>
      els.flatMap((el) => (el.clientWidth ? [el.getBoundingClientRect().left] : [])),
    )
  expect(new Set(lefts).size).toBeLessThanOrEqual(3)
  if (await page.locator('[data-tab="0"]').isVisible())
    expect(await page.locator('.layer:not(.inactive) h2').evaluate((el) => el.clientWidth)).toBe(1)
  const result = solve3d(await readRegions(page))
  expect(result.solutionCount).toBe(1)
  const solution = result.solutions[0]
  // The same cell in two layers shares a pillar, whatever else is true of it.
  await queen(page, 0, 7)
  await queen(page, 3, 7)
  await expect(page.locator('.cell.mistake[data-index="7"]')).toHaveCount(2)
  await (await cell(page, 0, 7)).click()
  await (await cell(page, 3, 7)).click()
  await expect(page.locator('.cell.mistake')).toHaveCount(0)
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) await queen(page, solution[r][c], r * N + c)
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
  await expect(page.getByText(/次操作 · 0 次提示/)).toBeVisible()
  // The win is kept in its own stacked bucket, apart from the flat 5 × 5 sizes.
  const stats = (await page.evaluate(() => localStorage.getItem('queens:stats:v1'))) ?? ''
  expect(Object.keys((JSON.parse(stats) as { buckets: object }).buckets)).toEqual(['3d:5:easy'])
  await page.goto('/stats')
  await expect(page.getByRole('row', { name: /5 × 5 × 5/ })).toBeVisible()
})

test('single player offers the classic and the stacked board, the stacked one marked new', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('a[href*="solo3d"]')).toHaveCount(0)
  await page.locator('.mode-card', { hasText: '單人遊戲' }).click()
  await expect(page).toHaveURL(/\/play$/)
  await expect(page.locator('.mode-card')).toHaveCount(2)
  await expect(page.locator('.mode-card .badge')).toHaveCount(1)
  const stacked = page.getByRole('link', { name: /3D Queens/ })
  await expect(stacked.locator('.badge')).toHaveText('NEW')
  await expect(page.getByRole('link', { name: /^經典 Queens/ })).toHaveAttribute('href', /\/solo$/)
  await stacked.click()
  await expect(page).toHaveURL(/\/solo3d/)
  await expect(cells(page)).toHaveCount(N ** 3, { timeout: 30000 })
  // The header reaches the same choice from anywhere.
  await page.getByRole('link', { name: '單人遊戲', exact: true }).click()
  await expect(page).toHaveURL(/\/play$/)
})

test('the focused cell is outlined in every other layer, and ] moves to the next layer', async ({
  page,
}) => {
  await open(page)
  await (await cell(page, 0, 12)).focus()
  await expect(page.locator('.cell.linked')).toHaveCount(N - 1)
  expect(
    await page
      .locator('.cell.linked')
      .evaluateAll((els) =>
        els.map((el) => `${el.getAttribute('data-layer')}:${el.getAttribute('data-index')}`),
      ),
  ).toEqual(['1:12', '2:12', '3:12', '4:12'])
  await expect(page.locator('.thumbnail .linked')).toHaveCount(N - 1)
  await page.keyboard.press(']')
  await expect(page.locator('[data-layer="1"][data-index="12"]')).toBeFocused()
  await expect(page.locator('.cell.linked[data-layer="0"][data-index="12"]')).toHaveCount(1)
  await expect(page.locator('.cell.linked[data-layer="1"]')).toHaveCount(0)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('[')
  await expect(page.locator('[data-layer="0"][data-index="13"]')).toBeFocused()
  await page.keyboard.press('[')
  await expect(page.locator('[data-layer="0"][data-index="13"]')).toBeFocused()
})

test('undo, redo and a three-level hint work across layers', async ({ page }) => {
  await open(page)
  const target = await cell(page, 2, 3)
  await target.click()
  await expect(target).toHaveAttribute('data-state', 'marked')
  await page.getByRole('button', { name: '復原' }).click()
  await expect(target).toHaveAttribute('data-state', 'empty')
  await page.getByRole('button', { name: '重做' }).click()
  await expect(target).toHaveAttribute('data-state', 'marked')
  await page.getByRole('button', { name: '復原' }).click()
  await page.getByRole('button', { name: '給我一點提示' }).click()
  await expect(page.locator('.feedback')).toContainText('先看看第')
  await expect(page.locator('.cell.highlighted').first()).toBeAttached()
  await page.getByRole('button', { name: '再多一點提示' }).click()
  await page.getByRole('button', { name: '告訴我答案' }).click()
  await expect(page.locator('.feedback')).toContainText('層')
  const before = await cells(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-state')),
  )
  await page.getByRole('button', { name: '套用這一步 →' }).click()
  const after = await cells(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-state')),
  )
  expect(after).not.toEqual(before)
})

test('a shared link reproduces the board and a reload continues the game', async ({
  page,
  context,
}) => {
  await open(page)
  const regions = await readRegions(page)
  await page.locator('.share-button').click()
  const shared = await page.locator('#share-link').inputValue()
  expect(shared).toContain(link)
  await page.keyboard.press('Escape')
  const other = await context.newPage()
  await other.goto(shared)
  await expect(cells(other)).toHaveCount(N ** 3, { timeout: 30000 })
  expect(await readRegions(other)).toEqual(regions)
  await other.close()

  await queen(page, 1, 8)
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          (JSON.parse(localStorage.getItem(key) ?? 'null') as { moves: number } | null)?.moves,
        KEY,
      ),
    )
    .toBe(2)
  // The flat board's save is a separate key and stays untouched.
  expect(await page.evaluate(() => localStorage.getItem('queens:solo-progress:v1'))).toBeNull()
  await page.reload()
  await expect(cells(page)).toHaveCount(N ** 3, { timeout: 30000 })
  await expect(page.locator('[data-layer="1"][data-index="8"]')).toHaveAttribute(
    'data-state',
    'queen',
  )
  expect(await readRegions(page)).toEqual(regions)
  await page.getByRole('button', { name: '復原' }).click()
  await expect(page.locator('[data-layer="1"][data-index="8"]')).toHaveAttribute(
    'data-state',
    'marked',
  )
})

test('the resume prompt and the generating notice are exactly as tall as the board', async ({
  page,
}) => {
  await open(page)
  const board = await page
    .locator('.board-slot')
    .evaluate((el) => el.getBoundingClientRect().height)
  await queen(page, 1, 8)
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, KEY))
    .toBe(true)
  await page.goto('/solo3d')
  await expect(page.getByRole('heading', { name: '繼續上一局？' })).toBeVisible()
  const slot = page.locator('.board-slot')
  const prompt = page.locator('.board-slot > .empty-board')
  expect(await slot.evaluate((el) => el.getBoundingClientRect().height)).toBeCloseTo(board, 0)
  expect(await prompt.evaluate((el) => el.getBoundingClientRect().height)).toBeCloseTo(board, 0)
  // Record every height the slot takes while the saved game loads: it must never change.
  await slot.evaluate((el) => {
    const heights = ((window as unknown as { heights: number[] }).heights = [
      el.getBoundingClientRect().height,
    ])
    new ResizeObserver(() => heights.push(el.getBoundingClientRect().height)).observe(el)
  })
  await page.getByRole('button', { name: '繼續這一局' }).click()
  await expect(page.locator('[data-layer="1"][data-index="8"]')).toHaveAttribute(
    'data-state',
    'queen',
    {
      timeout: 30000,
    },
  )
  const heights = await page.evaluate(() => (window as unknown as { heights: number[] }).heights)
  for (const height of heights) expect(height).toBeCloseTo(board, 0)
})

test('an old version link is refused and the pillar guidance option only shows here', async ({
  page,
}) => {
  await page.goto(`/solo3d?size=${N}&difficulty=easy&seed=42&v=0.0.1`)
  await expect(page.getByText(GENERATOR_3D_VERSION)).toBeVisible()
  await expect(cells(page)).toHaveCount(0)
  await open(page)
  await page.getByRole('button', { name: '遊玩設定' }).click()
  await page.getByLabel('顯示皇冠排除範圍').check()
  await expect(page.getByLabel('同一柱')).toBeChecked()
  await page.keyboard.press('Escape')
  await queen(page, 0, 7)
  // Thumbnails cross out what the crown rules out: its row, column, region and neighbours in the
  // layer, the same cell in every other layer, and the player's own X marks.
  const crossed = (z: number) =>
    page
      .locator(`[data-tab="${z}"] .thumbnail i`)
      .evaluateAll((els) => els.flatMap((el, i) => (el.classList.contains('blocked') ? [i] : [])))
  expect(await crossed(2)).toEqual([7])
  expect(await crossed(0)).toEqual(
    expect.arrayContaining([1, 2, 3, 5, 6, 8, 9, 11, 12, 13, 17, 22]),
  )
  expect(await crossed(0)).not.toContain(7)
  await (await cell(page, 2, 20)).click()
  expect(await crossed(2)).toEqual([7, 20])
  for (let z = 1; z < N; z++)
    await expect(page.locator(`[data-layer="${z}"][data-index="7"]`)).toHaveAttribute(
      'data-guided',
      'true',
    )
  // The settings are below the board; starting a game from them scrolls back up to it.
  await page.getByRole('button', { name: '開始新遊戲' }).click()
  await expect(page).not.toHaveURL(/seed=42&/)
  await expect(cells(page)).toHaveCount(N ** 3, { timeout: 30000 })
  await expect(page.locator('.game-meta')).toBeInViewport()
  await page.goto('/solo?size=6&difficulty=easy&seed=42')
  await expect(page.getByRole('gridcell')).toHaveCount(36, { timeout: 30000 })
  await page.getByRole('button', { name: '遊玩設定' }).click()
  await expect(page.getByLabel('同一欄')).toBeVisible()
  await expect(page.getByLabel('同一柱')).toHaveCount(0)
})

test('a paused stacked board can be resumed', async ({ page }) => {
  await page.goto(link)
  await expect(cells(page)).toHaveCount(N ** 3)
  await page.getByRole('button', { name: '暫停遊戲', exact: true }).click()
  const resume = page.getByRole('button', { name: '繼續遊戲', exact: true }).last()
  await expect(resume).toBeEnabled()
  await resume.click()
  await expect(page.getByRole('button', { name: '暫停遊戲', exact: true })).toBeVisible()
})

test('hover mode pins a cell without changing it and outlines its pillar in every layer', async ({
  page,
  isMobile,
}) => {
  await page.goto(link)
  await expect(cells(page)).toHaveCount(N ** 3)
  const toggle = page.getByRole('button', { name: '懸停模式' })
  // A mouse can hover, so only a touch screen is offered the mode.
  if (!isMobile) return expect(toggle).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  const target = await cell(page, 0, 7)
  await target.click()
  // The tap changed nothing, and the pillar is outlined in the thumbnail of every layer.
  await expect(target).toHaveAttribute('data-state', 'empty')
  await expect(page.locator('.thumbnail .linked')).toHaveCount(N)
  // Opening another layer shows the same pillar outlined there.
  await page.locator('[data-tab="3"]').click()
  await expect(page.locator('[data-layer="3"][data-index="7"]')).toHaveClass(/linked/)
  // A second tap on the pinned cell clears it.
  await (await cell(page, 0, 7)).click()
  await expect(page.locator('.thumbnail .linked')).toHaveCount(0)
  // With the mode off, a tap marks the cell again.
  await toggle.click()
  await (await cell(page, 0, 7)).click()
  await expect(await cell(page, 0, 7)).toHaveAttribute('data-state', 'marked')
})
