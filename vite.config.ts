import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    watch: {
      ignored: ['**/.nvm/**', '**/.cache/**', '**/.local/**', '**/node_modules/**', '**/.vite-plus/**'],
    },
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      // dev-time bridge to the ArkOJ backend (server/)
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  fmt: { singleQuote: true, semi: false },
  lint: { ignorePatterns: ['dist/**'] },
})
