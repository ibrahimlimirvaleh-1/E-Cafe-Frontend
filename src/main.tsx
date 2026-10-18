import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { AuthProvider } from './shared/auth/AuthContext'
import { ThemeProvider } from './shared/theme/ThemeContext'
import { applyTheme, getInitialTheme } from './shared/theme/theme'
import './shared/i18n/i18n'
import { LocalizationBridge } from './shared/i18n/LocalizationBridge'
import { restoreCachedDictionaries } from './shared/i18n/catalog'
import './styles/tokens.css'
import './styles/globals.css'
import './styles/dark-theme.css'

applyTheme(getInitialTheme())
restoreCachedDictionaries()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LocalizationBridge />
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
