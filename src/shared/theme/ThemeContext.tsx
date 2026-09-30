import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { applyTheme, getSavedTheme, getSystemTheme, themeStorageKey, type Theme } from './theme'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Theme | null>(getSavedTheme)
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme)
  const theme = preference ?? systemTheme

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = () => setSystemTheme(media.matches ? 'dark' : 'light')
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === themeStorageKey || event.key === null) {
        setPreference(getSavedTheme())
      }
    }

    media.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorageChange)
    return () => {
      media.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setPreference(nextTheme)
    try {
      window.localStorage.setItem(themeStorageKey, nextTheme)
    } catch {
      // The in-memory preference still works when storage is unavailable.
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }
  return context
}
