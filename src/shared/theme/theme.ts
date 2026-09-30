export type Theme = 'light' | 'dark'

export const themeStorageKey = 'ecafe.theme'

export function getSavedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(themeStorageKey)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getInitialTheme(): Theme {
  return getSavedTheme() ?? getSystemTheme()
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}
