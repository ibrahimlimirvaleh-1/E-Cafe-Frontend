import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TextareaField, TextField } from './FormField'
import type { ContentField, ContentLanguage, TranslationValues } from '../i18n/contentTranslations'
import './content-translation-tabs.css'

type Props = {
  azContent: ReactNode
  fields: ContentField[]
  value: TranslationValues
  onChange: (value: TranslationValues) => void
}

const labels: Record<ContentField, string> = {
  name: 'ui.content.name',
  description: 'ui.content.description',
  unavailableReason: 'ui.content.unavailableReason',
}

export function ContentTranslationTabs({ azContent, fields, value, onChange }: Props) {
  const { t } = useTranslation()
  const [activeLanguage, setActiveLanguage] = useState<'az' | ContentLanguage>('az')

  return <div className="content-translation-editor">
    <div className="content-translation-tabs" role="tablist" aria-label={t('ui.content.languages')}>
      {(['az', 'en', 'ru'] as const).map((language) => <button
        key={language}
        type="button"
        role="tab"
        aria-selected={activeLanguage === language}
        className={activeLanguage === language ? 'active' : ''}
        onClick={() => setActiveLanguage(language)}
      >{language.toUpperCase()}</button>)}
    </div>
    <div className="content-translation-panel" role="tabpanel">
      {activeLanguage === 'az' ? azContent : <div className="form-grid two">
        {fields.map((field) => {
          const onFieldChange = (next: string) => onChange({
            ...value,
            [activeLanguage]: { ...value[activeLanguage], [field]: next },
          })
          return field === 'description'
            ? <TextareaField key={field} label={t(labels[field])} value={value[activeLanguage][field] ?? ''} onChange={(event) => onFieldChange(event.target.value)} />
            : <TextField key={field} label={t(labels[field])} value={value[activeLanguage][field] ?? ''} onChange={(event) => onFieldChange(event.target.value)} />
        })}
      </div>}
    </div>
  </div>
}
