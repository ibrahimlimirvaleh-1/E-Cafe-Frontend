import { i18n } from '../../shared/i18n/i18n'
import { LogOut, RefreshCw, Table2 } from 'lucide-react'
import { useState } from 'react'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { TextareaField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { ReservationReasonDialog } from './ReservationReasonDialog'
import './reservation-waiting.css'

type Props = {
  reservation: ReservationResponse
  restaurantId: string
  onChanged: (message: string) => void
}

type Decision = 'table' | 'departure' | null

export function ReservationWaitingManagement({ reservation, restaurantId, onChanged }: Props) {
  const [decision, setDecision] = useState<Decision>(null)
  const [pending, setPending] = useState<Decision>(null)
  const [selectedTableId, setSelectedTableId] = useState('')
  const [customerConsent, setCustomerConsent] = useState(false)
  const [reasonCode, setReasonCode] = useState<1 | 2 | ''>('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const { data: tables, error: tablesError, isLoading: tablesLoading } = useAsyncData(
    () => decision === 'table' ? ecafeApi.tables.listStrict(restaurantId) : Promise.resolve([]),
    [], [restaurantId, decision, reloadKey],
  )
  const candidates = tables.filter((table) => table.restaurantId === restaurantId && table.isActive && table.capacity >= reservation.peopleCount &&
    table.id !== String(reservation.tableId) && table.status !== 'Occupied' && table.status !== 'Hidden')
  const selectedTable = candidates.find((table) => table.id === selectedTableId)
  const validReason = reason.trim().length >= 1 && reason.trim().length <= 500

  // Qərar verilərkən ekran məlumatına deyil, serverin son masa və rezervasiya yoxlamasına güvənirik.
  async function confirmDecision() {
    if (busy || !pending) return
    if (reservation.requiresReceptionReview && pending === 'table') return
    setBusy(true)
    setError('')
    try {
      let result
      if (pending === 'table') {
        if (!selectedTable || !customerConsent) return
        result = await ecafeApi.reservations.changeTable(restaurantId, String(reservation.id), Number(selectedTable.id))
      } else {
        if (!reasonCode || !validReason) return
        result = await ecafeApi.reservations.recordDeparture(restaurantId, String(reservation.id), reasonCode, reason.trim())
      }
      setPending(null)
      setDecision(null)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      onChanged(result.message)
    } catch (caught) {
      setError(normalizeCaughtApiError(caught, 'Qərar qeydə alınmadı.').message)
    } finally {
      setBusy(false)
    }
  }

  if (!reservation.waiting && !reservation.requiresReceptionReview) return null

  return <section className="reservation-waiting-management" aria-labelledby="waiting-management-title">
    <div className="reservation-waiting-management-header">
      <div><span className="section-eyebrow">{i18n.t('ui.features.reservations.reservation_waiting_management.gelis_c010c0')}</span><h2 id="waiting-management-title">{reservation.requiresReceptionReview ?i18n.t('ui.features.reservations.reservation_waiting_management.gelis_neticesini_yoxlayin_3e785b') :i18n.t('ui.features.reservations.reservation_waiting_management.gozleyen_qonaq_ucun_qerar_648b4d')}</h2></div>
      {reservation.waiting?.isOverdue && !reservation.requiresReceptionReview ? <span className="reservation-waiting-alert">{i18n.t('ui.features.reservations.reservation_waiting_management.servis_gecikir_be3878')}</span> : null}
    </div>
    {reservation.requiresReceptionReview ? <p className="reservation-waiting-muted">{i18n.t('ui.features.reservations.reservation_waiting_management.xidmet_muddeti_bitib_qonagin_faktiki_a_5f2725')}</p> : null}
    <div className={`reservation-waiting-modes${reservation.requiresReceptionReview ? ' is-review' : ''}`} role="group" aria-label={i18n.t('ui.features.reservations.reservation_waiting_management.qerar_novu_950532')}>
      {!reservation.requiresReceptionReview ? <button aria-pressed={decision === 'table'} className={decision === 'table' ? 'is-active' : ''} onClick={() => { setDecision('table'); setError('') }} type="button"><Table2 size={17} />{i18n.t('ui.features.reservations.reservation_waiting_management.basqa_masa_1dff38')}</button> : null}
      <button aria-pressed={decision === 'departure'} className={decision === 'departure' ? 'is-active' : ''} onClick={() => { setDecision('departure'); setError('') }} type="button"><LogOut size={17} />{i18n.t('ui.features.reservations.reservation_waiting_management.ayrilmani_qeyd_et_785bfb')}</button>
    </div>

    {decision === 'table' && !reservation.requiresReceptionReview ? <div className="reservation-waiting-form">
      <label className="ui-field"><span>{i18n.t('ui.features.reservations.reservation_waiting_management.yeni_masa_6573fd')}</span>
        <select disabled={busy || tablesLoading || Boolean(tablesError)} onChange={(event) => { setSelectedTableId(event.target.value); setCustomerConsent(false) }} value={selectedTableId}>
          <option value="">{i18n.t('ui.features.reservations.reservation_waiting_management.masa_secin_9e3905')}</option>
          {candidates.map((table) => <option key={table.id} value={table.id}>{table.name || `Masa-${table.number}`} · {table.capacity} {i18n.t('ui.features.reservations.reservation_waiting_management.neferlik_2dc0b2')}</option>)}
        </select>
      </label>
      {tablesLoading ? <p className="reservation-waiting-muted">{i18n.t('ui.features.reservations.reservation_waiting_management.masalar_yuklenir_fa9b85')}</p> : null}
      {tablesError ? <div className="reservation-waiting-error"><StatusMessage tone="danger" autoHideMs={false}>{tablesError}</StatusMessage><Button aria-label={i18n.t('ui.features.reservations.reservation_waiting_management.masa_siyahisini_yenile_501254')} onClick={() => setReloadKey((value) => value + 1)} title={i18n.t('ui.features.reservations.reservation_waiting_management.masa_siyahisini_yenile_501254')} type="button" variant="secondary"><RefreshCw size={17} /></Button></div> : null}
      {!tablesLoading && !tablesError && candidates.length === 0 ? <p className="reservation-waiting-muted">{i18n.t('ui.features.reservations.reservation_waiting_management.uygun_alternativ_masa_tapilmadi_0f0f6c')}</p> : null}
      <label className="reservation-waiting-consent"><input checked={customerConsent} disabled={busy || !selectedTable} onChange={(event) => setCustomerConsent(event.target.checked)} type="checkbox" /><span>{i18n.t('ui.features.reservations.reservation_waiting_management.qonagin_masa_deyisikliyine_raziligini__1085de')}</span></label>
      <Button disabled={busy || tablesLoading || Boolean(tablesError) || !selectedTable || !customerConsent} onClick={() => { setError(''); setPending('table') }} type="button"><Table2 size={17} />{i18n.t('ui.features.reservations.reservation_waiting_management.masani_deyis_4bc182')}</Button>
    </div> : null}

    {decision === 'departure' ? <div className="reservation-waiting-form">
      <label className="ui-field"><span>{i18n.t('ui.features.reservations.reservation_waiting_management.ayrilma_sebebi_cf5bda')}</span>
        <select disabled={busy} onChange={(event) => setReasonCode(event.target.value === '1' ? 1 : event.target.value === '2' ? 2 : '')} value={reasonCode}>
          <option value="">{i18n.t('ui.features.reservations.reservation_waiting_management.sebebi_secin_7673d1')}</option>
          <option value="1">{i18n.t('ui.features.reservations.reservation_waiting_management.restoran_masa_temin_ede_bilmedi_7e6a31')}</option>
          <option value="2">{i18n.t('ui.features.reservations.reservation_waiting_management.qonaq_ozu_ayrildi_d6ad89')}</option>
        </select>
      </label>
      <TextareaField label={i18n.t('ui.features.reservations.reservation_waiting_management.izah_3a0632')} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={i18n.t('ui.features.reservations.reservation_waiting_management.ayrilmanin_sebebini_yazin_4e41f2')} required rows={3} value={reason} />
      <Button disabled={busy || !reasonCode || !validReason} onClick={() => { setError(''); setPending('departure') }} type="button" variant="danger"><LogOut size={17} />{i18n.t('ui.features.reservations.reservation_waiting_management.ayrilmani_tesdiqle_3ecf15')}</Button>
    </div> : null}

    {error && !pending ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    <ReservationReasonDialog
      confirmLabel={pending === 'table' ?i18n.t('ui.features.reservations.reservation_waiting_management.masani_deyis_4bc182') :i18n.t('ui.features.reservations.reservation_waiting_management.ayrilmani_tesdiqle_3ecf15')}
      confirmVariant={pending === 'departure' ? 'danger' : 'primary'}
      description={pending === 'table'
        ? `${selectedTable?.name || `Masa-${selectedTable?.number || ''}`} qonağın razılığı ilə təyin ediləcək. Masa sessiyası açılmayacaq.`
        : reasonCode === 1
          ?i18n.t('ui.features.reservations.reservation_waiting_management.restoran_masa_temin_ede_bilmediyi_ucun_be2beb')
          :i18n.t('ui.features.reservations.reservation_waiting_management.qonagin_ozu_ayrildigi_qeyd_edilecek_od_868408')}
      error={pending ? error : ''}
      isOpen={Boolean(pending)}
      isSubmitting={busy}
      onClose={() => { if (!busy) setPending(null) }}
      onConfirm={() => void confirmDecision()}
      title={pending === 'table' ?i18n.t('ui.features.reservations.reservation_waiting_management.yeni_masani_tesdiqleyirsiniz_2ea2cb') :i18n.t('ui.features.reservations.reservation_waiting_management.qonagin_ayrilmasini_tesdiqleyirsiniz_76be2d')}
    />
  </section>
}
