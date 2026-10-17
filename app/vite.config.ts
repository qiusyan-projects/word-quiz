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
    // 两套部署目标，输出位置不同：
    //  - Cloudflare Pages 把 Root directory 设为 app/，产物必须落在 app 内，否则报
    //    「output directory 不在根目录下」；CF 构建时会注入 CF_PAGES=1。
    //  - 本地 / WorkBuddy 托管：输出到仓库根的 dist/，部署目录就是它。
    outDir: process.env.CF_PAGES ? 'dist' : '../dist',
    emptyOutDir: true, // 目标在 root 之外时必须显式开启
    chunkSizeWarningLimit: 1600, // 词库单文件约 1.1MB，属预期
  },
})
