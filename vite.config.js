import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 使用相对路径，确保部署到 GitHub Pages 的仓库子路径时资源也能正确加载
  base: './',
  plugins: [vue()],
  server: {
    host: true,
    port: 5173
  }
})
