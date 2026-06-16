import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initFontSizePreference } from './constants/fontSizePreference.js'
import { migrateLegacyAppUrlIfNeeded, pruneDefaultScopedQuery } from './utils/appRoute.js'
import './index.css'

initFontSizePreference()
migrateLegacyAppUrlIfNeeded()
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
