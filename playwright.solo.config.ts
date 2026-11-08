import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e-solo',
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'zh-TW' },
  projects: [
    { name: 'desktop', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['Pixel 7'] },
  ],
  webServer: {
    command:
      'npm run build:solo && npx vite preview --mode solo --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/queens-garden/',
    timeout: 120000,
  },
})
