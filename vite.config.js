import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { kakaoApiDevPlugin, prodSnapshotReadProxyPlugin } from './scripts/vite-kakao-api-plugin.js'

/** GitHub Pages: TMS_PAGES_BASE=/cxr542-ai/projects/edu-team-tms/ npm run build:team */
const base = process.env.TMS_PAGES_BASE || '/'
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base,
  plugins: [react(), prodSnapshotReadProxyPlugin(), kakaoApiDevPlugin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV || ''),
    'import.meta.env.VITE_DEPLOY_ORIGIN': JSON.stringify(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : '',
    ),
  },
  server: {
    port: 3000,
    /** 3000 고정 — 점유 중이면 dev 서버가 종료되므로 기존 프로세스를 종료하세요 */
    strictPort: true,
    open: true,
    proxy: {
      '/ppt-academizer-api': {
        target: 'http://127.0.0.1:8766',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ppt-academizer-api/, ''),
      },
    },
  },
})
