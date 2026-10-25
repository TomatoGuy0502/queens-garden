import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    // The suite asserts Traditional Chinese text; language switching has its own tests.
    locale: 'zh-TW',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], locale: 'zh-TW' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], locale: 'zh-TW' } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm start',
        url: 'http://127.0.0.1:5174/api/health',
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          NODE_ENV: 'production',
          PORT: '5174',
          LOCAL_TEST_MODE: '1',
          PUZZLE_PREFILL: '0',
          // Every test browser creates rooms from 127.0.0.1, far past the production limit.
          ROOM_CREATE_LIMIT: '1000',
          PUBLIC_ORIGIN: 'http://127.0.0.1:5174',
          ROOM_FILE: '.data/e2e-rooms-v2.json',
          PUZZLE_CATALOG_FILE: '.data/e2e-rooms-v2.json.puzzles.json',
        },
      },
})
