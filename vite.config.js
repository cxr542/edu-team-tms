import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { kakaoApiDevPlugin } from './scripts/vite-kakao-api-plugin.js'

/** GitHub Pages: TMS_PAGES_BASE=/cxr542-ai/projects/edu-team-tms/ npm run build:team */
const base = process.env.TMS_PAGES_BASE || '/'
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base,
  plugins: [react(), kakaoApiDevPlugin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    port: 3000,
    /** 3000이 사용 중이면 3001 등 다음 포트로 자동 이동 (터미널 Local URL 확인) */
    strictPort: false,
    open: true,
    proxy: {
      '/ppt-academizer-api': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ppt-academizer-api/, ''),
      },
    },
  },
})
