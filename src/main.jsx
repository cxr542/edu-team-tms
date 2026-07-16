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
import './styles/uiTooltip.css'
import './pages/PublicViewerGuidePage.css'

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
