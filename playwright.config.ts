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
    : [
        {
          command: 'npm run dev:web -- --port 5174 --strictPort',
          env: { API_PROXY_TARGET: 'http://127.0.0.1:3004' },
          url: 'http://127.0.0.1:5174',
          reuseExistingServer: false,
        },
        {
          command: 'npm run dev:server',
          url: 'http://127.0.0.1:3004/api/health',
          reuseExistingServer: false,
          timeout: 30000,
          env: {
            PORT: '3004',
            LOCAL_TEST_MODE: '1',
            PUBLIC_ORIGIN: 'http://127.0.0.1:5174',
            ROOM_FILE: '.data/e2e-rooms-v2.json',
          },
        },
      ],
})
