import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initFontSizePreference } from './constants/fontSizePreference.js'
import './index.css'

initFontSizePreference()
import './styles/projectShell.css'
import './styles/uiTooltip.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
