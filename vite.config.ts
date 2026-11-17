import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // MathJax 通过 eval('require') 读取 package.json 版本，浏览器端不存在 require。
    // 注入构建期常量后，该 Node 专用分支不会被执行。
    PACKAGE_VERSION: JSON.stringify('3.2.1'),
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
