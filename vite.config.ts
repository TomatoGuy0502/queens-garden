import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/socket.io': { target: 'http://127.0.0.1:3001', ws: true },
    },
  },
  plugins: [vue(), UnoCSS()],
  test: { include: ['src/tests/**/*.test.ts'], testTimeout: 30000 },
})
