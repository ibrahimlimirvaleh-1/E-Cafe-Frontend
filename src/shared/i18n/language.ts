export const supportedLanguages = ['az', 'en', 'ru'] as const
export type Language = (typeof supportedLanguages)[number]

const languageStorageKey = 'ecafe.language'

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && supportedLanguages.includes(value as Language)
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'az'
  try {
    const stored = window.localStorage.getItem(languageStorageKey)
    return isLanguage(stored) ? stored : 'az'
  } catch {
    return 'az'
  }
}

export function hasStoredLanguageSelection(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return isLanguage(window.localStorage.getItem(languageStorageKey))
  } catch {
    return false
  }
}

export function saveLanguage(language: Language) {
  try {
    window.localStorage.setItem(languageStorageKey, language)
  } catch {
    // The active page still uses the selected language without storage.
  }
}

export function getIntlLocale(language: Language): string {
  return { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' }[language]
}
