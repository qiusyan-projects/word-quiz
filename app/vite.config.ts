import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // 相对路径产物，便于静态托管 / 直接双击 dist/index.html
  base: './',
  build: {
    // 直接产出到仓库根的部署目录：只留一份产物，避免 app/dist 与 dist 不一致
    outDir: '../dist',
    emptyOutDir: true, // 目标在 root 之外，必须显式开启
    chunkSizeWarningLimit: 1600, // 词库单文件约 1.1MB，属预期
  },
})
