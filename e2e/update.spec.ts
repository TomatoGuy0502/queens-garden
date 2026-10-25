import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
const isIndex = (url: URL) => url.pathname === '/'
const notice = (page: Page) => page.getByText('網站有新版本')
// The page checks for a new build whenever it becomes visible again.
async function returnToTab(page: Page) {
  const checked = page.waitForResponse((response) => isIndex(new URL(response.url())))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await checked
}
/** Serves the page as a newer build would: same HTML, renamed entry script. */
async function deploy(page: Page) {
  await page.route(isIndex, async (route) => {
    const response = await route.fetch()
    const body = (await response.text()).replace(
      /\/assets\/index-[\w-]+\.js/,
      '/assets/index-next.js',
    )
    await route.fulfill({ response, body })
  })
  await returnToTab(page)
  await expect(notice(page)).toBeVisible()
}
test('the same build shows no notice; a new one offers a reload that loads it', async ({
  page,
}) => {
  await page.goto('/')
  await returnToTab(page)
  await expect(notice(page)).toHaveCount(0)
  await deploy(page)
  await page.unroute(isIndex)
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: '重新整理' }).click(),
  ])
  await expect(notice(page)).toHaveCount(0)
})
test('a dismissed update notice stays closed for the rest of the visit', async ({ page }) => {
  await page.goto('/')
  await deploy(page)
  await page.getByRole('button', { name: '關閉更新通知' }).click()
  await expect(notice(page)).toHaveCount(0)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(300)
  await expect(notice(page)).toHaveCount(0)
})
