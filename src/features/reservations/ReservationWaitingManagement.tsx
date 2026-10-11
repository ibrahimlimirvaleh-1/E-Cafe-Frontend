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
      <div><span className="section-eyebrow">GƏLİŞ</span><h2 id="waiting-management-title">{reservation.requiresReceptionReview ? 'Gəliş nəticəsini yoxlayın' : 'Gözləyən qonaq üçün qərar'}</h2></div>
      {reservation.waiting?.isOverdue && !reservation.requiresReceptionReview ? <span className="reservation-waiting-alert">Servis gecikir</span> : null}
    </div>
    {reservation.requiresReceptionReview ? <p className="reservation-waiting-muted">Xidmət müddəti bitib. Qonağın faktiki ayrıldığını təsdiqlədikdən sonra səbəbi qeyd edin. Rezervasiya avtomatik ləğv edilməyib.</p> : null}
    <div className={`reservation-waiting-modes${reservation.requiresReceptionReview ? ' is-review' : ''}`} role="group" aria-label="Qərar növü">
      {!reservation.requiresReceptionReview ? <button aria-pressed={decision === 'table'} className={decision === 'table' ? 'is-active' : ''} onClick={() => { setDecision('table'); setError('') }} type="button"><Table2 size={17} />Başqa masa</button> : null}
      <button aria-pressed={decision === 'departure'} className={decision === 'departure' ? 'is-active' : ''} onClick={() => { setDecision('departure'); setError('') }} type="button"><LogOut size={17} />Ayrılmanı qeyd et</button>
    </div>

    {decision === 'table' && !reservation.requiresReceptionReview ? <div className="reservation-waiting-form">
      <label className="ui-field"><span>Yeni masa</span>
        <select disabled={busy || tablesLoading || Boolean(tablesError)} onChange={(event) => { setSelectedTableId(event.target.value); setCustomerConsent(false) }} value={selectedTableId}>
          <option value="">Masa seçin</option>
          {candidates.map((table) => <option key={table.id} value={table.id}>{table.name || `Masa-${table.number}`} · {table.capacity} nəfərlik</option>)}
        </select>
      </label>
      {tablesLoading ? <p className="reservation-waiting-muted">Masalar yüklənir...</p> : null}
      {tablesError ? <div className="reservation-waiting-error"><StatusMessage tone="danger" autoHideMs={false}>{tablesError}</StatusMessage><Button aria-label="Masa siyahısını yenilə" onClick={() => setReloadKey((value) => value + 1)} title="Masa siyahısını yenilə" type="button" variant="secondary"><RefreshCw size={17} /></Button></div> : null}
      {!tablesLoading && !tablesError && candidates.length === 0 ? <p className="reservation-waiting-muted">Uyğun alternativ masa tapılmadı.</p> : null}
      <label className="reservation-waiting-consent"><input checked={customerConsent} disabled={busy || !selectedTable} onChange={(event) => setCustomerConsent(event.target.checked)} type="checkbox" /><span>Qonağın masa dəyişikliyinə razılığını aldım.</span></label>
      <Button disabled={busy || tablesLoading || Boolean(tablesError) || !selectedTable || !customerConsent} onClick={() => { setError(''); setPending('table') }} type="button"><Table2 size={17} />Masanı dəyiş</Button>
    </div> : null}

    {decision === 'departure' ? <div className="reservation-waiting-form">
      <label className="ui-field"><span>Ayrılma səbəbi</span>
        <select disabled={busy} onChange={(event) => setReasonCode(event.target.value === '1' ? 1 : event.target.value === '2' ? 2 : '')} value={reasonCode}>
          <option value="">Səbəbi seçin</option>
          <option value="1">Restoran masa təmin edə bilmədi</option>
          <option value="2">Qonaq özü ayrıldı</option>
        </select>
      </label>
      <TextareaField label="İzah" maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Ayrılmanın səbəbini yazın" required rows={3} value={reason} />
      <Button disabled={busy || !reasonCode || !validReason} onClick={() => { setError(''); setPending('departure') }} type="button" variant="danger"><LogOut size={17} />Ayrılmanı təsdiqlə</Button>
    </div> : null}

    {error && !pending ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    <ReservationReasonDialog
      confirmLabel={pending === 'table' ? 'Masanı dəyiş' : 'Ayrılmanı təsdiqlə'}
      confirmVariant={pending === 'departure' ? 'danger' : 'primary'}
      description={pending === 'table'
        ? `${selectedTable?.name || `Masa-${selectedTable?.number || ''}`} qonağın razılığı ilə təyin ediləcək. Masa sessiyası açılmayacaq.`
        : reasonCode === 1
          ? 'Restoran masa təmin edə bilmədiyi üçün rezervasiya ləğv ediləcək. Ödənilmiş depozit varsa, geri ödəniş hüququ mövcud qaydaya əsasən hesablanacaq.'
          : 'Qonağın özü ayrıldığı qeyd ediləcək. Ödənilmiş depozit varsa, geri ödəniş hüququ mövcud ləğv qaydasına əsasən hesablanacaq.'}
      error={pending ? error : ''}
      isOpen={Boolean(pending)}
      isSubmitting={busy}
      onClose={() => { if (!busy) setPending(null) }}
      onConfirm={() => void confirmDecision()}
      title={pending === 'table' ? 'Yeni masanı təsdiqləyirsiniz?' : 'Qonağın ayrılmasını təsdiqləyirsiniz?'}
    />
  </section>
}
