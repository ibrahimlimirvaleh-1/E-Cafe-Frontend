import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ecafeApi } from '../api/ecafeApi'
import { normalizeCaughtApiError } from '../api/httpClient'
import { useKeyedAsyncData } from '../hooks/useAsyncData'
import type { ContentEntityType, ContentLanguage, ContentTranslationResponse } from '../i18n/contentTranslations'
import { Button } from './Button'
import { TextField } from './FormField'
import { StatusMessage } from './StatusMessage'
import './content-translation-tabs.css'

type Props = { entityType: Extract<ContentEntityType, 'units'>; id: string; onChanged?: () => void }

export function StandaloneContentTranslationEditor({ entityType, id, onChanged }: Props) {
  const { t } = useTranslation()
  const [language, setLanguage] = useState<ContentLanguage>('en')
  const [names, setNames] = useState<Record<ContentLanguage, string>>({ en: '', ru: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const { data, error: loadError, isLoading, isRefreshing } = useKeyedAsyncData(
    () => ecafeApi.contentTranslations.detail(entityType, id),
    null as ContentTranslationResponse | null,
    `${entityType}:${id}`,
    [entityType, id, reloadKey],
  )
  const hydrated = useRef<ContentTranslationResponse | null>(null)

  useEffect(() => {
    if (!data || hydrated.current === data) return
    hydrated.current = data
    setNames({
      en: data.translations.find((row) => row.languageCode === 'en')?.name ?? '',
      ru: data.translations.find((row) => row.languageCode === 'ru')?.name ?? '',
    })
  }, [data])

  const existing = data?.translations.find((row) => row.languageCode === language)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data || isLoading || isRefreshing || loadError || busy) return
    const name = names[language].trim()
    if (!name) { setError(t('ui.content.nameRequired')); return }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const updated = await ecafeApi.contentTranslations.save(entityType, id, language, {
        expectedRevision: existing?.revision ?? 0,
        name,
      })
      setNames({
        en: updated.translations.find((row) => row.languageCode === 'en')?.name ?? '',
        ru: updated.translations.find((row) => row.languageCode === 'ru')?.name ?? '',
      })
      setMessage(t('ui.content.saved'))
      setReloadKey((value) => value + 1)
      onChanged?.()
    } catch (cause) {
      setError(normalizeCaughtApiError(cause, t('ui.content.saveFailed')).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!data || !existing?.name || isLoading || isRefreshing || loadError || busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await ecafeApi.contentTranslations.delete(entityType, id, language, existing.revision)
      setNames((current) => ({ ...current, [language]: '' }))
      setMessage(t('ui.content.removed'))
      setReloadKey((value) => value + 1)
      onChanged?.()
    } catch (cause) {
      setError(normalizeCaughtApiError(cause, t('ui.content.deleteFailed')).message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="content-translation-editor content-standalone-editor">
    {isLoading && !data ? <p role="status">{t('ui.content.loading')}</p> : null}
    {loadError ? <div><StatusMessage tone="danger" autoHideMs={false}>{loadError}</StatusMessage>
      <Button type="button" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>{t('ui.content.retry')}</Button></div> : null}
    {data && !loadError ? <>
      <p className="content-standalone-source"><strong>AZ</strong> {data.translations.find((row) => row.languageCode === 'az')?.name}</p>
      <div className="content-translation-tabs" role="tablist" aria-label={t('ui.content.languages')}>
        {(['en', 'ru'] as const).map((code) => <button key={code} type="button" role="tab" aria-selected={language === code}
          className={language === code ? 'active' : ''} onClick={() => { setLanguage(code); setError(''); setMessage('') }}>{code.toUpperCase()}</button>)}
      </div>
      <form onSubmit={save} className="content-standalone-form">
        <TextField label={t('ui.content.name')} value={names[language]} maxLength={100} required
          onChange={(event) => setNames((current) => ({ ...current, [language]: event.target.value }))} />
        <div className="content-standalone-actions">
          <Button type="submit" disabled={busy || isLoading || isRefreshing}>{t('ui.content.saveTranslation')}</Button>
          <Button type="button" variant="danger" disabled={!existing?.name || busy || isLoading || isRefreshing} onClick={() => void remove()}>{t('ui.content.removeTranslation')}</Button>
        </div>
      </form>
      {error ? <div><StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage>
        <Button type="button" variant="secondary" disabled={busy || isRefreshing} onClick={() => setReloadKey((value) => value + 1)}>{t('ui.content.retry')}</Button></div> : null}
      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}
    </> : null}
  </div>
}
