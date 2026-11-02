import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Moon, Sun } from 'lucide-react'
import { changeLanguage, getCurrentLanguage } from '../src/shared/i18n/i18n'
import type { Language } from '../src/shared/i18n/language'
import { applyTheme, getInitialTheme, type Theme } from '../src/shared/theme/theme'
import { StatusMessage } from '../src/shared/ui/StatusMessage'
import '../src/styles/tokens.css'
import '../src/styles/globals.css'
import '../src/styles/dark-theme.css'
import './status-messages.css'

const copy = {
  az: {
    heading: 'Sistem mesajları',
    success: 'Dəyişikliklər yadda saxlanıldı.',
    info: 'Məlumatlar yenilənir.',
    warning: 'Davam etmək üçün tarix seçin.',
    danger: 'Məlumatlar yadda saxlanılmadı.',
    field: 'Tarix',
    detail: 'Bu sahə tələb olunur.',
    replay: 'Yenidən göstər',
    light: 'Açıq tema',
    dark: 'Tünd tema',
    all: 'Hamısı',
    current: 'Əvvəlki',
    line: 'Vurğu xətti',
    quiet: 'Neytral',
    compact: 'Yığcam',
    tones: { success: 'Uğur', info: 'Məlumat', warning: 'Xəbərdarlıq', danger: 'Xəta' },
  },
  en: {
    heading: 'System messages',
    success: 'Changes were saved.',
    info: 'Information is updating.',
    warning: 'Select a date to continue.',
    danger: 'Changes could not be saved.',
    field: 'Date',
    detail: 'This field is required.',
    replay: 'Show again',
    light: 'Light theme',
    dark: 'Dark theme',
    all: 'All',
    current: 'Previous',
    line: 'Accent line',
    quiet: 'Neutral',
    compact: 'Compact',
    tones: { success: 'Success', info: 'Info', warning: 'Warning', danger: 'Error' },
  },
  ru: {
    heading: 'Системные сообщения',
    success: 'Изменения сохранены.',
    info: 'Данные обновляются.',
    warning: 'Выберите дату, чтобы продолжить.',
    danger: 'Не удалось сохранить изменения.',
    field: 'Дата',
    detail: 'Это поле обязательно.',
    replay: 'Показать снова',
    light: 'Светлая тема',
    dark: 'Тёмная тема',
    all: 'Все',
    current: 'Предыдущий',
    line: 'Акцентная линия',
    quiet: 'Нейтральный',
    compact: 'Компактный',
    tones: { success: 'Успех', info: 'Информация', warning: 'Внимание', danger: 'Ошибка' },
  },
} as const

type Tone = 'success' | 'info' | 'warning' | 'danger'
type Variant = 'current' | 'line' | 'quiet' | 'compact'
type View = 'all' | Variant
const tones: Tone[] = ['success', 'info', 'warning', 'danger']
const variants: Variant[] = ['current', 'line', 'quiet', 'compact']

function Preview() {
  const [language, setLanguage] = useState<Language>(getCurrentLanguage())
  const [theme, setTheme] = useState<Theme>(getInitialTheme())
  const [view, setView] = useState<View>('all')
  const [keys, setKeys] = useState<Record<string, number>>({})
  const labels = copy[language]

  function replay(variant: Variant, tone: Tone) {
    const identity = `${variant}:${tone}`
    setKeys((current) => ({ ...current, [identity]: (current[identity] || 0) + 1 }))
  }

  return (
    <main className="message-preview">
      <header className="message-preview-header">
        <h1>{labels.heading}</h1>
        <div className="message-preview-controls">
          <div className="message-preview-languages" aria-label="Language">
            {(['az', 'en', 'ru'] as const).map((value) => (
              <button key={value} aria-pressed={language === value} className={language === value ? 'is-selected' : ''}
                onClick={() => { setLanguage(value); void changeLanguage(value) }} type="button">{value.toUpperCase()}</button>
            ))}
          </div>
          <button aria-label={theme === 'light' ? labels.dark : labels.light} className="message-preview-theme"
            onClick={() => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); applyTheme(next) }}
            title={theme === 'light' ? labels.dark : labels.light} type="button">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>
      <div className="message-preview-views" aria-label="Design variants">
        {(['all', ...variants] as View[]).map((option) => (
          <button aria-pressed={view === option} className={view === option ? 'is-selected' : ''}
            key={option} onClick={() => setView(option)} type="button">{labels[option]}</button>
        ))}
      </div>
      <div className={`message-preview-gallery${view === 'all' ? ' is-comparison' : ''}`}>
        {(view === 'all' ? variants : [view]).map((variant) => (
          <section className={`message-preview-variant variant-${variant}`} key={variant}>
            <h2>{labels[variant]}</h2>
            <div className="message-preview-grid">
              {tones.map((tone) => (
                <div className="message-preview-example" key={tone}>
                  <div className="message-preview-example-header">
                    <h3>{labels.tones[tone]}</h3>
                    <button onClick={() => replay(variant, tone)} type="button">{labels.replay}</button>
                  </div>
                  <StatusMessage autoHideMs={view === 'all' ? false : undefined}
                    key={`${variant}:${tone}:${keys[`${variant}:${tone}`] || 0}`} tone={tone}
                    details={tone === 'danger' ? [{ field: 'date', label: labels.field, message: labels.detail }] : undefined}>
                    {labels[tone]}
                  </StatusMessage>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

applyTheme(getInitialTheme())
createRoot(document.getElementById('root')!).render(<Preview />)
