import { ArrowRight, Check, Clock3, Send, Undo2, X } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { RestaurantWorkingHour } from '../../entities/types'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { Badge } from '../../shared/ui/Badge'
import { TextareaField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { WorkingHoursField, WorkingHoursList } from '../../shared/ui/WorkingHoursField'
import { scheduleApi, type ScheduleChange } from './scheduleApi'
import './schedule.css'

const states = {
  Pending: { label: 'Cavab gözlənilir', tone: 'warning' },
  Accepted: { label: 'Razılaşıb', tone: 'success' },
  Rejected: { label: 'Qəbul etməyib', tone: 'danger' },
} as const

export function RestaurantSchedulePanel({ restaurantId, workingHours, onApplied }: {
  restaurantId: string; workingHours: RestaurantWorkingHour[]; onApplied: () => void
}) {
  const [hours, setHours] = useState(workingHours)
  const [reason, setReason] = useState('')
  const [change, setChange] = useState<ScheduleChange | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<'success' | 'warning'>('success')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionNote, setSessionNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const version = useRef(0)
  const pending = change?.state === 'Pending'

  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])
  useEffect(() => {
    let active = true
    const currentVersion = version.current
    scheduleApi.get(restaurantId).then((data) => {
      if (active && version.current === currentVersion) setChange(data)
    }).catch((err) => {
      if (active && version.current === currentVersion) setError(normalizeCaughtApiError(err, 'İş saatı dəyişikliyi yüklənmədi.').message)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [restaurantId, reloadKey])

  async function run(request: () => Promise<ScheduleChange>, success: string) {
    if (busy) return
    version.current++
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await request()
      setChange(result)
      const blocked = result.state === 'Pending' && success === 'İş saatları tətbiq edildi.'
      setNoticeTone(blocked ? 'warning' : 'success')
      setNotice(blocked
        ? 'Dəyişiklik tətbiq edilmədi. Siyahıda həll edilməmiş rezervasiya və ya sessiya var.' : success)
      setSessionId(null); setSessionNote(''); setAgreed(false)
      if (result.state === 'Applied') onApplied()
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setError(normalizeCaughtApiError(err, 'Dəyişiklik saxlanılmadı.').message)
      setReloadKey((value) => value + 1)
    } finally { setBusy(false) }
  }
  function propose(event: FormEvent) {
    event.preventDefault()
    run(() => scheduleApi.propose(restaurantId, hours, reason), 'Təklif göndərildi. Mövcud iş saatları hələ dəyişməyib.')
  }

  return <section className="schedule-section" id="schedule-change" aria-labelledby="schedule-change-title">
    <h2 id="schedule-change-title"><Clock3 size={20} /> İş saatı dəyişikliyi</h2>
    {loading ? <p role="status">Məlumatlar yüklənir...</p> : !pending ? <form onSubmit={propose}>
      <WorkingHoursField value={hours} onChange={setHours} />
      <TextareaField label="Dəyişiklik səbəbi" required maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button type="submit" disabled={busy || !reason.trim()}><Send size={17} /> Təklif göndər</Button>
    </form> : change ? <>
      <p>{change.reason}</p>
      <WorkingHoursList workingHours={change.workingHours} />
      <p className="schedule-muted">Mövcud şərtlər razılaşma tamamlanana qədər qüvvədədir. Təsirlənən vaxtlarda yeni rezervasiya qəbulu müvəqqəti dayandırılıb.</p>
      {change.participants.length ? <div className="schedule-table-wrap">
        <table className="schedule-table">
          <thead><tr><th>Müştəri / masa</th><th>Gəliş</th><th>Təklif edilən təhvil</th><th>Cavab</th><th>Əməliyyat</th></tr></thead>
          <tbody>{change.participants.map((item) => <tr key={item.id}>
            <td><strong>{item.customerName || 'Masa sessiyası'}</strong><small>{item.tableName} · {item.reservationId ? `#${item.reservationId}` : `Sessiya #${item.tableSessionId}`}</small></td>
            <td data-label="Gəliş">{formatReservationDateTime(item.arrivalAt, change.timeZone)}</td>
            <td data-label="Təklif edilən təhvil">{item.proposedVacateAt ? formatReservationDateTime(item.proposedVacateAt, change.timeZone) : 'Gəliş vaxtı uyğun deyil'}</td>
            <td data-label="Cavab"><Badge tone={states[item.state].tone}>{states[item.state].label}</Badge>{item.responseNote ? <small>{item.responseNote}</small> : null}</td>
            <td>{item.reservationId ? <ButtonLink variant="secondary" to={`/admin/reservations/${item.reservationId}?restaurantId=${restaurantId}`}>Detal <ArrowRight size={16} /></ButtonLink>
              : item.state === 'Pending' ? <Button type="button" variant="secondary" disabled={busy} onClick={() => { setSessionId(item.id); setAgreed(false); setSessionNote('') }}>Razılaşmanı qeyd et</Button> : null}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p>Ziddiyyətli aktiv rezervasiya və masa sessiyası yoxdur.</p>}
      {sessionId != null ? <div className="schedule-session-response">
        <TextareaField label="Müştəri ilə razılaşma qeydi" required maxLength={1000} rows={3} value={sessionNote} onChange={(event) => setSessionNote(event.target.value)} />
        <label className="schedule-consent"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} disabled={busy} /><span>Müştəriyə yeni bağlanış vaxtını bildirdim və razılığını aldım.</span></label>
        <div className="schedule-actions">
          <Button type="button" disabled={busy || !agreed || !sessionNote.trim() || !change.participants.find(p => p.id === sessionId)?.canAccept}
            onClick={() => run(() => scheduleApi.session(restaurantId, sessionId, change.token, true, sessionNote), 'Razılaşma qeyd edildi.')}><Check size={17} /> Razılığı qeyd et</Button>
          <Button type="button" variant="secondary" disabled={busy || !sessionNote.trim()}
            onClick={() => run(() => scheduleApi.session(restaurantId, sessionId, change.token, false, sessionNote), 'Müştərinin razılaşmadığı qeyd edildi.')}><X size={17} /> Razılaşmayıb</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setSessionId(null)}>Bağla</Button>
        </div>
      </div> : null}
      {!change.canApply ? <p className="schedule-muted" role="status">
        {change.participants.filter(item => item.state !== 'Accepted' || !item.canAccept).length} razılaşma hələ həll edilməyib.
      </p> : null}
      <div className="schedule-actions">
        <Button type="button" disabled={busy || !change.canApply} onClick={() => run(() => scheduleApi.apply(restaurantId, change.token), 'İş saatları tətbiq edildi.')}><Check size={17} /> Dəyişikliyi tətbiq et</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => run(() => scheduleApi.withdraw(restaurantId, change.token), 'Təklif geri götürüldü.')}><Undo2 size={17} /> Təklifi geri götür</Button>
      </div>
    </> : null}
    {notice ? <StatusMessage tone={noticeTone} autoHideMs={false}>{notice}</StatusMessage> : null}
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
  </section>
}
