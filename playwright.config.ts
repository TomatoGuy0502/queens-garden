import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
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
          PUBLIC_ORIGIN: 'http://127.0.0.1:5174',
          ROOM_FILE: '.data/e2e-rooms-v2.json',
        },
      },
})
