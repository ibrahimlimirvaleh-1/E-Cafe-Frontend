import { useEffect, useId, useRef, useState } from 'react'
import { Check, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, getCurrentLanguage } from '../i18n/i18n'
import { isLanguage, type Language } from '../i18n/language'
import { useAuth } from '../auth/AuthContext'
import { ecafeApi } from '../api/ecafeApi'
import './language-switcher.css'

const languageOptions: { value: Language; label: string }[] = [
  { value: 'az', label: 'Azərbaycanca' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
]

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : getCurrentLanguage()
  const currentLabel = languageOptions.find((option) => option.value === language)?.label

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const selectLanguage = (nextLanguage: Language) => {
    setIsOpen(false)
    triggerRef.current?.focus()
    if (nextLanguage === language) return
    void changeLanguage(nextLanguage)
    if (isAuthenticated) void ecafeApi.localization.setPreference(nextLanguage).catch(() => {})
  }

  return <div className="language-switcher" ref={rootRef}>
    <button
      ref={triggerRef}
      className="language-switcher-trigger"
      type="button"
      aria-label={`${t('ui.language.label')}: ${currentLabel}`}
      aria-expanded={isOpen}
      aria-controls={menuId}
      title={`${t('ui.language.label')}: ${currentLabel}`}
      onClick={() => setIsOpen((open) => !open)}
    >
      <Languages size={19} aria-hidden="true" />
    </button>
    {isOpen ? <div className="language-switcher-menu" id={menuId} role="group" aria-label={t('ui.language.label')}>
      {languageOptions.map((option) => <button
        key={option.value}
        type="button"
        className="language-switcher-option"
        lang={option.value}
        aria-pressed={language === option.value}
        onClick={() => selectLanguage(option.value)}
      >
        <span>{option.label}</span>
        {language === option.value ? <Check size={16} aria-hidden="true" /> : null}
      </button>)}
    </div> : null}
  </div>
}
