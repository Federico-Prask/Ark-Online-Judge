import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 5173,
    // 防止代理/浏览器缓存旧 bundle 导致"老前端"幽灵状态
    headers: { 'Cache-Control': 'no-store' },
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
