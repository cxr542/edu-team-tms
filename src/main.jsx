import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initFontSizePreference } from './constants/fontSizePreference.js'
import {
  migrateLegacyAppUrlIfNeeded,
  migrateLegacyModuleQueryIfNeeded,
  pruneDefaultScopedQuery,
} from './utils/appRoute.js'
import './index.css'

initFontSizePreference()
migrateLegacyAppUrlIfNeeded()
migrateLegacyModuleQueryIfNeeded()
if (typeof window !== 'undefined') {
  const url = new URL(window.location.href)
  pruneDefaultScopedQuery(url)
  const next = `${url.pathname}${url.search}`
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState({}, '', next)
  }
}
import './styles/projectShell.css'
import './styles/pageHeader.css'
import './styles/uiTooltip.css'
import './styles/okestroTokens.css'
import './pages/PublicViewerGuidePage.css'

// 새 배포 후 이미 열려 있던 탭은 옛 화면 파일(해시가 바뀐 청크)을 찾지 못한다.
// 그때 한 번만 새로고침해 새 버전을 받는다. 1분 안에 다시 실패하면 반복하지 않는다.
const CHUNK_RELOAD_KEY = 'tms-chunk-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('TMS service worker registration failed', error)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
