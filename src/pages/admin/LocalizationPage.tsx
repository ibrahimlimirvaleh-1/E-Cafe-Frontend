import { Languages, RefreshCw, RotateCcw, Save, Search, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ecafeApi, type LocalizationDraftResponse, type LocalizationEntry, type LocalizationReleaseResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { refreshDictionary } from '../../shared/i18n/catalog'
import { getCurrentLanguage, i18n } from '../../shared/i18n/i18n'
import { getIntlLocale } from '../../shared/i18n/language'
import { Button } from '../../shared/ui/Button'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './localization.css'

type ConfirmAction = { kind: 'publish' } | { kind: 'rollback'; releaseId: number }
const pageSize = 25

export function LocalizationPage() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<LocalizationDraftResponse | null>(null)
  const [releases, setReleases] = useState<LocalizationReleaseResponse[]>([])
  const [edits, setEdits] = useState<Record<string, LocalizationEntry>>({})
  const [view, setView] = useState<'draft' | 'releases'>('draft')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextDraft, nextReleases] = await Promise.all([
        ecafeApi.localization.getDraft(), ecafeApi.localization.getReleases(),
      ])
      setDraft(nextDraft)
      setReleases(nextReleases)
      setEdits({})
    } catch (cause) {
      setError(normalizeCaughtApiError(cause, i18n.t('ui.localization.loadFailed')).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(getIntlLocale(getCurrentLanguage()))
    return (draft?.entries ?? []).filter((entry) => !term ||
      [entry.key, entry.az, entry.en, entry.ru].some((value) => value.toLocaleLowerCase(getIntlLocale(getCurrentLanguage())).includes(term)))
  }, [draft, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize)
  const dirtyCount = Object.keys(edits).length

  function updateEntry(entry: LocalizationEntry, language: 'az' | 'en' | 'ru', value: string) {
    const original = draft?.entries.find((item) => item.key === entry.key)
    if (!original) return
    const updated = { ...entry, [language]: value }
    setEdits((current) => {
      const next = { ...current }
      if (updated.az === original.az && updated.en === original.en && updated.ru === original.ru) delete next[entry.key]
      else next[entry.key] = updated
      return next
    })
  }

  async function save() {
    if (!draft || dirtyCount === 0 || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      let revision = draft.revision
      const pending = Object.values(edits)
      for (let offset = 0; offset < pending.length; offset += 250) {
        const batch = pending.slice(offset, offset + 250)
        const result = await ecafeApi.localization.saveDraft(revision, batch)
        revision = result.revision
        setDraft(result)
        setEdits((current) => {
          const next = { ...current }
          for (const entry of batch) delete next[entry.key]
          return next
        })
      }
      setNotice(t('ui.localization.saved'))
    } catch (cause) {
      setError(normalizeCaughtApiError(cause, t('ui.localization.saveFailed')).message)
    } finally {
      setBusy(false)
    }
  }

  async function applyConfirmedAction() {
    if (!draft || !confirm || busy || dirtyCount > 0) return
    const action = confirm
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (action.kind === 'publish') await ecafeApi.localization.publish(draft.revision)
      else await ecafeApi.localization.rollback(action.releaseId, draft.revision)
      setConfirm(null)
      await load()
      void refreshDictionary(getCurrentLanguage(), true).catch(() => {})
      setNotice(t(action.kind === 'publish' ? 'ui.localization.published' : 'ui.localization.restored'))
    } catch (cause) {
      setError(normalizeCaughtApiError(cause, t('ui.localization.actionFailed')).message)
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return <main className="admin-page localization-page">
    <PageHeader eyebrow={t('ui.localization.eyebrow')} title={t('ui.localization.title')} action={
      <Button type="button" variant="secondary" disabled={loading || busy || dirtyCount > 0} onClick={() => void load()}>
        <RefreshCw size={17} />{t('ui.localization.refresh')}
      </Button>
    } />
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    {notice ? <StatusMessage tone="success" autoHideMs={false}>{notice}</StatusMessage> : null}
    <div className="localization-toolbar">
      <div className="localization-tabs" role="tablist" aria-label={t('ui.localization.views')}>
        <button role="tab" aria-selected={view === 'draft'} className={view === 'draft' ? 'active' : ''} type="button" onClick={() => setView('draft')}>{t('ui.localization.draft')}</button>
        <button role="tab" aria-selected={view === 'releases'} className={view === 'releases' ? 'active' : ''} type="button" onClick={() => setView('releases')}>{t('ui.localization.releases')}</button>
      </div>
      <span>{t('ui.localization.revision', { revision: draft?.revision ?? '-' })} · {t('ui.localization.publishedVersion', { version: draft?.publishedVersion ?? '-' })}</span>
    </div>
    {loading && !draft ? <p role="status">{t('ui.localization.loading')}</p> : null}
    {draft && view === 'draft' ? <>
      <div className="localization-filter">
        <label><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={t('ui.localization.search')} /></label>
        <span>{t('ui.localization.resultCount', { count: filtered.length })}</span>
      </div>
      <div className="localization-list" role="list">
        {visible.map((original) => {
          const entry = edits[original.key] ?? original
          return <section className="localization-row" role="listitem" key={original.key}>
            <div className="localization-key"><Languages size={16} aria-hidden="true" /><strong>{original.key}</strong>{edits[original.key] ? <span>{t('ui.localization.changed')}</span> : null}</div>
            <div className="localization-fields">{(['az', 'en', 'ru'] as const).map((language) =>
              <label key={language}><span>{language.toUpperCase()}</span><textarea rows={2} disabled={busy} value={entry[language]} aria-label={t('ui.localization.translationFor', { language: language.toUpperCase(), key: original.key })} onChange={(event) => updateEntry(entry, language, event.target.value)} /></label>)}</div>
          </section>
        })}
        {visible.length === 0 ? <p className="localization-empty">{t('ui.localization.empty')}</p> : null}
      </div>
      <div className="localization-footer">
        <div className="localization-pagination">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('ui.localization.previous')}</Button>
          <span>{t('ui.localization.page', { page: Math.min(page, totalPages), total: totalPages })}</span>
          <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{t('ui.localization.next')}</Button>
        </div>
        <div className="localization-commands">
          <Button type="button" variant="secondary" disabled={dirtyCount === 0 || busy} onClick={() => void save()}><Save size={17} />{t('ui.localization.save', { count: dirtyCount })}</Button>
          <Button type="button" disabled={dirtyCount > 0 || busy} onClick={() => setConfirm({ kind: 'publish' })}><Send size={17} />{t('ui.localization.publish')}</Button>
        </div>
      </div>
    </> : null}
    {draft && view === 'releases' ? <div className="localization-releases">
      {releases.map((release) => <div className="localization-release" key={release.id}>
        <div><strong>#{release.id}</strong><span>{new Intl.DateTimeFormat(getIntlLocale(getCurrentLanguage()), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(release.createdAt))}</span></div>
        <span>{t('ui.localization.revision', { revision: release.revision })}</span>
        <Button type="button" variant="secondary" disabled={dirtyCount > 0 || busy || draft.publishedVersion === String(release.id)} onClick={() => setConfirm({ kind: 'rollback', releaseId: release.id })}><RotateCcw size={17} />{t('ui.localization.rollback')}</Button>
      </div>)}
      {releases.length === 0 ? <p className="localization-empty">{t('ui.localization.noReleases')}</p> : null}
    </div> : null}
    <ConfirmDialog isOpen={confirm !== null} isDanger={confirm?.kind === 'rollback'} title={t(confirm?.kind === 'rollback' ? 'ui.localization.rollbackTitle' : 'ui.localization.publishTitle')} message={t(confirm?.kind === 'rollback' ? 'ui.localization.rollbackConfirm' : 'ui.localization.publishConfirm')} confirmLabel={t(confirm?.kind === 'rollback' ? 'ui.localization.rollback' : 'ui.localization.publish')} confirmDisabled={busy || dirtyCount > 0} onCancel={() => { if (!busy) setConfirm(null) }} onConfirm={() => void applyConfirmedAction()} />
  </main>
}
