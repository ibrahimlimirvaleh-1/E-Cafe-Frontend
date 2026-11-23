import { ChevronDown, Eye, Pencil, Plus, RefreshCw, Save, Send, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { announcementApi, type AdminAnnouncement, type AnnouncementDraft, type Destination } from '../../features/announcements/announcementApi'
import { ApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { roleLabel } from '../../shared/i18n/roleLabel'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function AnnouncementsPage() {
  const { t, i18n } = useTranslation()
  const { user, scopeRevision, isProfileVerified, isCurrentSession } = useAuth()
  const [items, setItems] = useState<AdminAnnouncement[]>([])
  const [destinations, setDestinations] = useState<{ key: Destination; roleIds: number[] }[]>([])
  const [cursor, setCursor] = useState<number>()
  const [next, setNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [conflict, setConflict] = useState(false)
  const [editing, setEditing] = useState(false)
  const [existing, setExisting] = useState<AdminAnnouncement>()
  const [draft, setDraft] = useState<AnnouncementDraft>({ destination: 'CustomerProfile', roleIds: [5], texts: ['az', 'en', 'ru'].map(language => ({ language: language as 'az' | 'en' | 'ru', title: '', body: '' })), expiresAtUtc: null })
  const [expiry, setExpiry] = useState('')
  const [language, setLanguage] = useState<'az' | 'en' | 'ru'>('az')
  const [confirmation, setConfirmation] = useState<{ item: AdminAnnouncement; published: boolean } | null>(null)
  const scope = `${user?.userId}:${scopeRevision}:${user?.roleId}:${user?.restaurantId}`
  const scopeRef = useRef(scope); scopeRef.current = scope
  const mounted = useRef(true)
  const loadRef = useRef<AbortController | null>(null)
  const writeRef = useRef<AbortController | null>(null)
  const ownsSession = () => Boolean(user && isCurrentSession(user.userId, scopeRevision.split(':')[0], user.roleId, user.restaurantId))
  const current = (controller: AbortController) => mounted.current && scopeRef.current === scope && !controller.signal.aborted && ownsSession()
  async function load(before?: number) {
    loadRef.current?.abort()
    const controller = new AbortController(); loadRef.current = controller
    setLoading(true)
    try {
      const [page, capabilities] = await Promise.all([announcementApi.list(before, controller.signal), announcementApi.destinations(controller.signal)])
      if (!current(controller)) return []
      setItems(page.items); setNext(page.hasMore ? page.nextBeforeId : null); setDestinations(capabilities); setCursor(before)
      return page.items
    } catch (err) { if (current(controller)) { setError(errorKey(err)); setDestinations([]) }; return [] }
    finally { if (current(controller)) setLoading(false) }
  }
  useEffect(() => {
    mounted.current = true
    writeRef.current = null; setBusy(false)
    if (isProfileVerified) void load()
    return () => { mounted.current = false; loadRef.current?.abort(); writeRef.current?.abort() }
    // Protected parent also keys this page by authenticated profile/session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, isProfileVerified])
  function edit(item?: AdminAnnouncement) {
    setExisting(item); setEditing(true); setError(''); setSuccess(''); setConflict(false)
    setLanguage('az')
    setDraft(item ? { destination: item.destination, roleIds: [...item.roleIds], texts: item.texts.map(text => ({ ...text })), expiresAtUtc: item.expiresAtUtc } : { destination: destinations[0]?.key || 'CustomerProfile', roleIds: [...(destinations[0]?.roleIds || [])], texts: ['az', 'en', 'ru'].map(language => ({ language: language as 'az' | 'en' | 'ru', title: '', body: '' })), expiresAtUtc: null })
    setExpiry(item?.expiresAtUtc ? new Date(item.expiresAtUtc).toISOString().slice(0, 16) : '')
  }
  async function write(operation: (signal: AbortSignal) => Promise<AdminAnnouncement>) {
    if (writeRef.current || user?.roleId !== '1' || !ownsSession()) return
    const controller = new AbortController(); writeRef.current = controller
    setBusy(true); setError(''); setSuccess('')
    try {
      const item = await operation(controller.signal)
      if (!current(controller)) return
      setItems(rows => rows.some(row => row.id === item.id) ? rows.map(row => row.id === item.id ? item : row) : [item, ...rows])
      setExisting(item); setDraft({ destination: item.destination, roleIds: [...item.roleIds], texts: item.texts.map(text => ({ ...text })), expiresAtUtc: item.expiresAtUtc }); setExpiry(item.expiresAtUtc ? new Date(item.expiresAtUtc).toISOString().slice(0, 16) : '')
      setEditing(true); setConfirmation(null); setConflict(false); setSuccess('saved')
    } catch (err) {
      if (!current(controller)) return
      const key = errorKey(err); setError(key); setConfirmation(null)
      if (key === 'changed' || key === 'mustBeDraft') { setConflict(true); await load(cursor) }
    } finally { if (current(controller)) { writeRef.current = null; setBusy(false) } }
  }
  function save(event: FormEvent) {
    event.preventDefault()
    if (existing?.isPublished || conflict) return
    const allowed = destinations.find(d => d.key === draft.destination)?.roleIds || []
    if (!draft.roleIds.length || draft.roleIds.some(role => !allowed.includes(role))) { setError('required'); return }
    const expiresAtUtc = expiry ? new Date(`${expiry}:00Z`) : null
    if (expiresAtUtc && Number.isNaN(expiresAtUtc.getTime())) { setError('invalidExpiry'); return }
    const body = { ...draft, texts: draft.texts.map(text => ({ ...text, title: text.title.trim(), body: text.body.trim() })), expiresAtUtc: expiresAtUtc?.toISOString() || null }
    void write(signal => announcementApi.save(body, existing, signal))
  }
  const currentText = draft.texts.find(text => text.language === language)!
  const allowedRoles = destinations.find(d => d.key === draft.destination)?.roleIds || []
  const readOnly = Boolean(existing?.isPublished)
  const unsaved = Boolean(existing && (draft.destination !== existing.destination || JSON.stringify(draft.roleIds) !== JSON.stringify(existing.roleIds) || JSON.stringify(draft.texts) !== JSON.stringify(existing.texts) || expiry !== (existing.expiresAtUtc ? new Date(existing.expiresAtUtc).toISOString().slice(0, 16) : '')))
  function confirmPublish() {
    if (!confirmation || conflict || !destinations.length) return
    if (editing && unsaved && confirmation.published && confirmation.item.id === existing?.id) { setError('saveBeforePublish'); setConfirmation(null); return }
    if (confirmation.published && confirmation.item.texts.some(text => !text.title.trim() || !text.body.trim())) { setError('required'); setConfirmation(null); return }
    if (confirmation.published && confirmation.item.expiresAtUtc && Date.parse(confirmation.item.expiresAtUtc) <= Date.now()) { setError('invalidExpiry'); setConfirmation(null); return }
    void write(signal => announcementApi.publish(confirmation.item, confirmation.published, signal))
  }
  if (!isProfileVerified) return <main className="admin-page"><PageHeader title={t('ui.announcements.management')} /><p role="status">{t('ui.announcements.loading')}</p></main>
  return <main className="admin-page announcement-admin">
    <PageHeader eyebrow={t('ui.announcements.management')} title={t('ui.announcements.management')} action={editing ? <Button variant="secondary" disabled={busy} onClick={() => { setEditing(false); setError(''); setSuccess('') }}><Undo2 size={18} />{t('ui.announcements.back')}</Button> : <Button disabled={loading || !destinations.length} onClick={() => edit()}><Plus size={18} />{t('ui.announcements.new')}</Button>} />
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{t(`ui.announcements.${error}`)}</StatusMessage> : null}
    {success ? <StatusMessage tone="success">{t(`ui.announcements.${success}`)}</StatusMessage> : null}
    {conflict ? <Button variant="secondary" disabled={busy || loading} onClick={() => { const item = items.find(row => row.id === existing?.id); if (item) edit(item); else { setEditing(false); setConflict(false) } }}><RefreshCw size={18} />{t('ui.announcements.reloadLatest')}</Button> : null}
    {editing ? <form className="announcement-editor" onSubmit={save} aria-busy={busy}>
      <div className="announcement-admin-toolbar"><Badge tone={readOnly ? 'success' : 'neutral'}>{t(readOnly ? 'ui.announcements.published' : 'ui.announcements.draft')}</Badge>{existing ? <span>{t('ui.announcements.version', { version: existing.version })}</span> : null}</div>
      {readOnly ? <StatusMessage tone="info" autoHideMs={false}>{t('ui.announcements.unpublishFirst')}</StatusMessage> : null}
      <SelectField label={t('ui.announcements.destination')} disabled={readOnly || busy || conflict} value={draft.destination} onChange={event => { const destination = event.target.value as Destination; const allowed = destinations.find(d => d.key === destination)?.roleIds || []; setDraft({ ...draft, destination, roleIds: [...allowed] }) }}>
        {destinations.map(destination => <option key={destination.key} value={destination.key}>{t(`ui.announcements.destination.${destination.key}`)}</option>)}
      </SelectField>
      <fieldset className="announcement-audience" disabled={readOnly || busy || conflict}><legend>{t('ui.announcements.audience')}</legend>{allowedRoles.map(role => <label key={role}><input type="checkbox" value={role} checked={draft.roleIds.includes(role)} onChange={event => setDraft({ ...draft, roleIds: event.target.checked ? [...draft.roleIds, role] : draft.roleIds.filter(id => id !== role) })} />{roleLabel(role)}</label>)}</fieldset>
      <div className="announcement-language-tabs" role="tablist" aria-label={t('ui.announcements.languages')}>{(['az', 'en', 'ru'] as const).map(value => <button type="button" role="tab" key={value} aria-selected={language === value} onClick={() => setLanguage(value)}>{value.toUpperCase()}</button>)}</div>
      <TextField label={t('ui.announcements.title')} maxLength={120} value={currentText.title} disabled={readOnly || busy || conflict} onChange={event => setDraft({ ...draft, texts: draft.texts.map(text => text.language === language ? { ...text, title: event.target.value } : text) })} />
      <TextareaField label={t('ui.announcements.body')} maxLength={600} rows={4} value={currentText.body} disabled={readOnly || busy || conflict} onChange={event => setDraft({ ...draft, texts: draft.texts.map(text => text.language === language ? { ...text, body: event.target.value } : text) })} />
      <TextField label={t('ui.announcements.expiry')} type="datetime-local" value={expiry} disabled={readOnly || busy || conflict} onChange={event => setExpiry(event.target.value)} />
      <section className="announcement-preview" aria-label={t('ui.announcements.preview')}><h3>{currentText.title || t('ui.announcements.preview')}</h3><p>{currentText.body}</p></section>
      <div className="announcement-admin-actions">{!readOnly ? <Button type="submit" disabled={busy || conflict || !destinations.length}><Save size={18} />{t('ui.announcements.saveDraft')}</Button> : null}
        {existing ? <Button type="button" variant="secondary" disabled={busy || conflict || unsaved || !destinations.length} title={unsaved ? t('ui.announcements.saveBeforePublish') : undefined} onClick={() => setConfirmation({ item: existing, published: !existing.isPublished })}>{existing.isPublished ? <Undo2 size={18} /> : <Send size={18} />}{t(existing.isPublished ? 'ui.announcements.unpublish' : 'ui.announcements.publish')}</Button> : null}</div>
    </form> : <>
      <div className="announcement-admin-toolbar"><span>{t('ui.announcements.records', { count: items.length })}</span><Button variant="secondary" disabled={loading} onClick={() => { setError(''); void load(undefined) }}><RefreshCw size={18} />{t('ui.announcements.refresh')}</Button></div>
      <div className="announcement-admin-list">{items.map(item => { const text = item.texts.find(text => text.language === i18n.resolvedLanguage) || item.texts[0]; return <article className="announcement-admin-item" key={item.id}>
        <header><h2>{text.title}</h2><Badge tone={item.isPublished ? 'success' : 'neutral'}>{t(item.isPublished ? 'ui.announcements.published' : 'ui.announcements.draft')} · v{item.version}</Badge></header><p>{text.body}</p><small>{item.roleIds.map(role => roleLabel(role)).join(', ')}</small>
        <div className="announcement-admin-actions"><Button variant="secondary" onClick={() => edit(item)}>{item.isPublished ? <Eye size={18} /> : <Pencil size={18} />}{t(item.isPublished ? 'ui.announcements.preview' : 'ui.announcements.edit')}</Button><Button variant="secondary" disabled={busy || !destinations.length} onClick={() => setConfirmation({ item, published: !item.isPublished })}>{item.isPublished ? <Undo2 size={18} /> : <Send size={18} />}{t(item.isPublished ? 'ui.announcements.unpublish' : 'ui.announcements.publish')}</Button></div>
      </article> })}</div>
      {!loading && !items.length ? <p>{t('ui.announcements.empty')}</p> : null}
      {loading ? <p role="status">{t('ui.announcements.loading')}</p> : null}
      {next ? <Button variant="secondary" disabled={loading} onClick={() => void load(next)}><ChevronDown size={18} />{t('ui.announcements.older')}</Button> : null}
    </>}
    <ConfirmDialog isOpen={Boolean(confirmation)} isDanger={confirmation?.published === false} title={t(confirmation?.published ? 'ui.announcements.publish' : 'ui.announcements.unpublish')} message={t('ui.announcements.releaseConfirmation')} confirmDisabled={busy} onCancel={() => { if (!writeRef.current) setConfirmation(null) }} onConfirm={confirmPublish} />
  </main>
}
function errorKey(error: unknown) {
  if (!(error instanceof ApiError)) return 'failed'
  const code = String(error.code)
  if (code === 'AnnouncementChanged' || code === '5202') return 'changed'
  if (code === 'AnnouncementMustBeDraft' || code === '5203') return 'mustBeDraft'
  if (code === 'AnnouncementNotFound' || code === '5200' || error.statusCode === 404) return 'notFound'
  if (code === 'AnnouncementInvalid' || code === '5201') return 'invalid'
  if ([401, 403].includes(error.statusCode)) return 'denied'
  if (error.statusCode === 429) return 'rateLimited'
  return 'failed'
}
