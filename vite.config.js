import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** GitHub Pages: TMS_PAGES_BASE=/cxr542-ai/projects/edu-team-tms/ npm run build:team */
const base = process.env.TMS_PAGES_BASE || '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})
