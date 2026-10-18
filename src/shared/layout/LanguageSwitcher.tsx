import { ChevronDown, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, getCurrentLanguage } from '../i18n/i18n'
import { isLanguage } from '../i18n/language'
import { useAuth } from '../auth/AuthContext'
import { ecafeApi } from '../api/ecafeApi'
import './language-switcher.css'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated } = useAuth()
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : getCurrentLanguage()

  return <label className="language-switcher" title={t('ui.language.label')}>
    <Languages size={17} aria-hidden="true" />
    <select aria-label={t('ui.language.label')} value={language} onChange={(event) => {
      if (isLanguage(event.target.value)) {
        const nextLanguage = event.target.value
        void changeLanguage(nextLanguage)
        if (isAuthenticated) void ecafeApi.localization.setPreference(nextLanguage).catch(() => {})
      }
    }}>
      <option value="az">AZ</option>
      <option value="en">EN</option>
      <option value="ru">RU</option>
    </select>
    <ChevronDown className="language-switcher-chevron" size={14} aria-hidden="true" />
  </label>
}
