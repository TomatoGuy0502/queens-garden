import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
export default defineConfig(({ mode }) => ({
  build: { outDir: mode === 'solo' ? 'dist-solo' : 'dist' },
  base: mode === 'solo' ? (process.env.PAGES_BASE_PATH ?? '/queens-garden/') : '/',
  server: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001',
      '/socket.io': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', ws: true },
    },
  },
  plugins: [vue(), UnoCSS()],
  test: { include: ['src/tests/**/*.test.ts'], testTimeout: 30000 },
}))
