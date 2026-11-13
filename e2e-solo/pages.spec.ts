import { test, expect } from '@playwright/test'
import { GENERATOR_VERSION } from '../src/queens/version'
import { solve } from '../src/queens/solver'

test('Pages subpath supports sharing, refresh, completion and local stats without a backend', async ({
  page,
}) => {
  const backend: string[] = []
  const errors: string[] = []
  page.on('request', (request) => {
    if (/\/api\/|\/socket.io/.test(request.url())) backend.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/queens-garden/')
  await expect(page.locator('a[href*="rooms"]')).toHaveCount(0)
  await expect(page.locator('.daily')).toContainText('今天還沒完成')
  await page.goto(`/queens-garden/#/solo?size=6&difficulty=easy&seed=42&v=${GENERATOR_VERSION}`)
  await expect(page.getByRole('gridcell')).toHaveCount(36)
  const regions = () =>
    page
      .getByRole('gridcell')
      .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-region'))))
  const first = await regions()
  await page.reload()
  await expect(page.getByRole('gridcell')).toHaveCount(36)
  expect(await regions()).toEqual(first)
  await page.locator('.share-button').click()
  const shared = await page.locator('#share-link').inputValue()
  expect(shared).toContain('/queens-garden/#/solo?')
  await page.keyboard.press('Escape')
  const board = Array.from({ length: 6 }, (_, row) => first.slice(row * 6, row * 6 + 6))
  const solution = solve(board).solutions[0]
  for (const [row, col] of solution.entries()) {
    const cell = page.locator(`[data-index="${row * 6 + col}"]`)
    await cell.click()
    await cell.click()
  }
  await expect(page.getByRole('heading', { name: '關卡完成' })).toBeVisible()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('queens:stats:v1') ?? 'null')),
  ).toBeTruthy()
  await page.goto('/queens-garden/#/stats')
  await page.reload()
  await expect(page.locator('main')).toBeVisible()
  // The stacked board is client-only too, and shares its link through the hash route.
  await page.goto('/queens-garden/#/solo3d?size=5&difficulty=easy&seed=42&v=1.0.0')
  await expect(page.locator('.cell[data-layer]')).toHaveCount(125)
  await page.locator('.share-button').click()
  expect(await page.locator('#share-link').inputValue()).toContain('/queens-garden/#/solo3d?')
  await page.keyboard.press('Escape')
  await page.goto('/queens-garden/#/rooms')
  await expect(page).toHaveURL(/#\/$/)
  expect(backend).toEqual([])
  expect(errors).toEqual([])
})
