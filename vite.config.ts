import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
export default defineConfig({ plugins: [vue(), UnoCSS()], test: { include: ['src/tests/**/*.test.ts'], testTimeout: 30000 } })
