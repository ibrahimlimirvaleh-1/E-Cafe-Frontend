import { i18n } from '../../shared/i18n/i18n'
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
    <h2 id="schedule-change-title"><Clock3 size={20} /> {i18n.t('ui.features.reservations.restaurant_schedule_panel.is_saati_deyisikliyi_681479')}</h2>
    {loading ? <p role="status">{i18n.t('ui.features.reservations.restaurant_schedule_panel.melumatlar_yuklenir_53bd5f')}</p> : !pending ? <form onSubmit={propose}>
      <WorkingHoursField value={hours} onChange={setHours} />
      <TextareaField label={i18n.t('ui.features.reservations.restaurant_schedule_panel.deyisiklik_sebebi_be525b')} required maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button type="submit" disabled={busy || !reason.trim()}><Send size={17} /> {i18n.t('ui.features.reservations.restaurant_schedule_panel.teklif_gonder_5b8388')}</Button>
    </form> : change ? <>
      <p>{change.reason}</p>
      <WorkingHoursList workingHours={change.workingHours} />
      <p className="schedule-muted">{i18n.t('ui.features.reservations.restaurant_schedule_panel.movcud_sertler_razilasma_tamamlanana_q_cbf46d')}</p>
      {change.participants.length ? <div className="schedule-table-wrap">
        <table className="schedule-table">
          <thead><tr><th>{i18n.t('ui.features.reservations.restaurant_schedule_panel.musteri_masa_99597e')}</th><th>{i18n.t('ui.features.reservations.restaurant_schedule_panel.gelis_00c2ae')}</th><th>{i18n.t('ui.features.reservations.restaurant_schedule_panel.teklif_edilen_tehvil_3a5048')}</th><th>{i18n.t('ui.features.reservations.restaurant_schedule_panel.cavab_6e6e8c')}</th><th>{i18n.t('ui.features.reservations.restaurant_schedule_panel.emeliyyat_fc71e9')}</th></tr></thead>
          <tbody>{change.participants.map((item) => <tr key={item.id}>
            <td><strong>{item.customerName || 'Masa sessiyası'}</strong><small>{item.tableName} · {item.reservationId ? `#${item.reservationId}` : `Sessiya #${item.tableSessionId}`}</small></td>
            <td data-label={i18n.t('ui.features.reservations.restaurant_schedule_panel.gelis_00c2ae')}>{formatReservationDateTime(item.arrivalAt, change.timeZone)}</td>
            <td data-label={i18n.t('ui.features.reservations.restaurant_schedule_panel.teklif_edilen_tehvil_3a5048')}>{item.proposedVacateAt ? formatReservationDateTime(item.proposedVacateAt, change.timeZone) :i18n.t('ui.features.reservations.restaurant_schedule_panel.gelis_vaxti_uygun_deyil_a74c63')}</td>
            <td data-label={i18n.t('ui.features.reservations.restaurant_schedule_panel.cavab_6e6e8c')}><Badge tone={states[item.state].tone}>{states[item.state].label}</Badge>{item.responseNote ? <small>{item.responseNote}</small> : null}</td>
            <td>{item.reservationId ? <ButtonLink variant="secondary" to={`/admin/reservations/${item.reservationId}?restaurantId=${restaurantId}`}>{i18n.t('ui.features.reservations.restaurant_schedule_panel.detal_409b6a')} <ArrowRight size={16} /></ButtonLink>
              : item.state === 'Pending' ? <Button type="button" variant="secondary" disabled={busy} onClick={() => { setSessionId(item.id); setAgreed(false); setSessionNote('') }}>{i18n.t('ui.features.reservations.restaurant_schedule_panel.razilasmani_qeyd_et_108fe5')}</Button> : null}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p>{i18n.t('ui.features.reservations.restaurant_schedule_panel.ziddiyyetli_aktiv_rezervasiya_ve_masa__6f3eed')}</p>}
      {sessionId != null ? <div className="schedule-session-response">
        <TextareaField label={i18n.t('ui.features.reservations.restaurant_schedule_panel.musteri_ile_razilasma_qeydi_15e6ec')} required maxLength={1000} rows={3} value={sessionNote} onChange={(event) => setSessionNote(event.target.value)} />
        <label className="schedule-consent"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} disabled={busy} /><span>{i18n.t('ui.features.reservations.restaurant_schedule_panel.musteriye_yeni_baglanis_vaxtini_bildir_ca2981')}</span></label>
        <div className="schedule-actions">
          <Button type="button" disabled={busy || !agreed || !sessionNote.trim() || !change.participants.find(p => p.id === sessionId)?.canAccept}
            onClick={() => run(() => scheduleApi.session(restaurantId, sessionId, change.token, true, sessionNote), 'Razılaşma qeyd edildi.')}><Check size={17} /> {i18n.t('ui.features.reservations.restaurant_schedule_panel.raziligi_qeyd_et_e5d9c3')}</Button>
          <Button type="button" variant="secondary" disabled={busy || !sessionNote.trim()}
            onClick={() => run(() => scheduleApi.session(restaurantId, sessionId, change.token, false, sessionNote), 'Müştərinin razılaşmadığı qeyd edildi.')}><X size={17} /> {i18n.t('ui.features.reservations.restaurant_schedule_panel.razilasmayib_9fc097')}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setSessionId(null)}>{i18n.t('ui.features.reservations.restaurant_schedule_panel.bagla_c1cf91')}</Button>
        </div>
      </div> : null}
      {!change.canApply ? <p className="schedule-muted" role="status">
        {change.participants.filter(item => item.state !== 'Accepted' || !item.canAccept).length} {i18n.t('ui.features.reservations.restaurant_schedule_panel.razilasma_hele_hell_edilmeyib_a17e11')}
      </p> : null}
      <div className="schedule-actions">
        <Button type="button" disabled={busy || !change.canApply} onClick={() => run(() => scheduleApi.apply(restaurantId, change.token), 'İş saatları tətbiq edildi.')}><Check size={17} /> {i18n.t('ui.features.reservations.restaurant_schedule_panel.deyisikliyi_tetbiq_et_9b388d')}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => run(() => scheduleApi.withdraw(restaurantId, change.token), 'Təklif geri götürüldü.')}><Undo2 size={17} /> {i18n.t('ui.features.reservations.restaurant_schedule_panel.teklifi_geri_gotur_b4f642')}</Button>
      </div>
    </> : null}
    {notice ? <StatusMessage tone={noticeTone} autoHideMs={false}>{notice}</StatusMessage> : null}
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
  </section>
}
