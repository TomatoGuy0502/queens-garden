import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: 'npm run dev:web',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'npm run dev:server',
          url: 'http://127.0.0.1:3001/api/health',
          reuseExistingServer: !process.env.CI,
          timeout: 30000,
          env: { ROOM_FILE: '.data/e2e-rooms.json' },
        },
      ],
})
