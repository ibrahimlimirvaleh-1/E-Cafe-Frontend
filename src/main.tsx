import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { AuthProvider } from './shared/auth/AuthContext'
import { ThemeProvider } from './shared/theme/ThemeContext'
import { applyTheme, getInitialTheme } from './shared/theme/theme'
import './styles/tokens.css'
import './styles/globals.css'
import './styles/dark-theme.css'

applyTheme(getInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
