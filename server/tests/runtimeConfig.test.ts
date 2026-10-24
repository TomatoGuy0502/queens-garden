import { expect, it } from 'vitest'
import { migrationUrl, storageConfig } from '../runtimeConfig'
const production = {
  DATABASE_URL: 'postgres://production/db',
  DATABASE_URL_UNPOOLED: 'postgres://production-direct/db',
  NEON_BRANCH: 'production',
}
it('ignores Neon production credentials in local development and uses explicit local credentials only', () => {
  expect(storageConfig(production).url).toBeUndefined()
  expect(
    storageConfig({ ...production, LOCAL_DATABASE_URL: 'postgres://development/db' }).url,
  ).toBe('postgres://development/db')
  expect(() => migrationUrl(production)).toThrow('Local migration requires')
  expect(
    migrationUrl({
      ...production,
      LOCAL_DATABASE_URL_UNPOOLED: 'postgres://development-direct/db',
    }),
  ).toBe('postgres://development-direct/db')
})
it('production requires a database while isolated E2E mode always uses files', () => {
  expect(() => storageConfig({ NODE_ENV: 'production' })).toThrow()
  expect(storageConfig({ ...production, NODE_ENV: 'production' }).url).toBe(production.DATABASE_URL)
  expect(
    storageConfig({
      ...production,
      LOCAL_DATABASE_URL: 'postgres://development/db',
      NODE_ENV: 'production',
      LOCAL_TEST_MODE: '1',
    }).url,
  ).toBeUndefined()
  expect(() =>
    migrationUrl({ ...production, NODE_ENV: 'production', LOCAL_TEST_MODE: '1' }),
  ).toThrow('disabled')
  expect(migrationUrl({ ...production, NODE_ENV: 'production' })).toBe(
    production.DATABASE_URL_UNPOOLED,
  )
})
