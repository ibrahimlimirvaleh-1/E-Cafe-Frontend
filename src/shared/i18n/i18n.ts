import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import az from './catalog/az.json'
import en from './catalog/en.json'
import ru from './catalog/ru.json'
import { getStoredLanguage, isLanguage, saveLanguage, type Language } from './language'

export const i18n = i18next.createInstance()

void i18n.use(initReactI18next).init({
  lng: getStoredLanguage(),
  fallbackLng: 'az',
  supportedLngs: ['az', 'en', 'ru'],
  resources: { az: { translation: az }, en: { translation: en }, ru: { translation: ru } },
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false, bindI18nStore: 'added' },
})

if (typeof document !== 'undefined') document.documentElement.lang = getStoredLanguage()

i18n.on('languageChanged', (value) => {
  if (!isLanguage(value)) return
  saveLanguage(value)
  if (typeof document !== 'undefined') document.documentElement.lang = value
})

export function getCurrentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : getStoredLanguage()
}

export async function changeLanguage(language: Language) {
  await i18n.changeLanguage(language)
}
