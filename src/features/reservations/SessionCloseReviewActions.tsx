import { i18n } from '../../shared/i18n/i18n'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import type { SessionBillResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { paymentStatusId } from '../../shared/lib/paymentStatus'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { SessionBillPanel } from '../settlement/SessionBillPanel'
import { ReservationReasonDialog } from './ReservationReasonDialog'
import { SessionContinueDialog } from './SessionContinueDialog'
import './session-close-review.css'

type Props = {
  id?: string
  restaurantId: string
  reservationId: number | null
  sessionId: number | null
  canComplete: boolean
  completeAs: 'manager' | 'waiter'
  canContinue: boolean
  requiresReview: boolean
  reviewDueAt: string | null
  reviewConfirmedAt: string | null
  timeZone?: string | null
  onChanged: (message: string) => void
  deferBill?: boolean
  onBillChange?: (bill: SessionBillResponse | null) => void
  billRevision?: number
}

export function SessionCloseReviewActions({ id, restaurantId, reservationId, sessionId, canComplete, completeAs, canContinue, requiresReview, reviewDueAt, reviewConfirmedAt, timeZone, onChanged, deferBill = false, onBillChange, billRevision }: Props) {
  const [dialog, setDialog] = useState<'complete' | 'continue' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showBill, setShowBill] = useState(!deferBill)
  const [bill, setBill] = useState<SessionBillResponse | null>(null)
  function updateBill(next: SessionBillResponse | null) {
    setBill(next)
    onBillChange?.(next)
  }

  // Bağlama və davam qərarları yalnız açıq istifadəçi təsdiqindən sonra göndərilir.
  async function complete() {
    if (busy || !canComplete || reservationId === null || sessionId === null) return
    setBusy(true)
    setError('')
    try {
      const latestBill = await ecafeApi.tableSessions.getBill(sessionId)
      updateBill(latestBill)
      if (!latestBill.canClose) {
        setDialog(null)
        setShowBill(true)
        window.dispatchEvent(new Event('ecafe:notifications-refresh'))
        setError(latestBill.hasUnservedOrders
          ? 'Sifarişlər təqdim edilməyib. Xidməti bitirməzdən əvvəl sifarişləri tamamlayın.'
          : latestBill.latestPayment?.statusId === paymentStatusId.pending
            ? 'Ödəniş hələ gözləmədədir. Nəticəsini yoxlayın.'
            : 'Masa hesabı tam ödənilməyib. Qalıq məbləği yoxlayın.')
        return
      }
      if (completeAs === 'waiter') await ecafeApi.reservations.completeService(restaurantId, String(reservationId))
      else await ecafeApi.reservations.completeSession(restaurantId, String(reservationId))
      setDialog(null)
      onChanged('Masa xidməti bitirildi.')
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (caught) {
      updateBill(null)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      setError(normalizeCaughtApiError(caught, 'Masa xidməti bitirilə bilmədi.').message)
    } finally {
      setBusy(false)
    }
  }

  async function continueService(reviewAgainAt: string, reason: string) {
    if (busy || !canContinue || sessionId === null) return
    setBusy(true)
    setError('')
    try {
      await ecafeApi.tableSessions.continueService(restaurantId, sessionId, reviewAgainAt, reason)
      setDialog(null)
      onChanged('Xidmətin davam etməsi qeyd edildi.')
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (caught) {
      setError(normalizeCaughtApiError(caught, 'Xidmətin davamı qeyd edilə bilmədi.').message)
    } finally {
      setBusy(false)
    }
  }

  if (!requiresReview && !canComplete && !reviewConfirmedAt && sessionId === null) return null

  return <div className="session-close-review" id={id}>
    {requiresReview ? <div className="session-close-review-warning" role="status">
      <Clock3 size={18} aria-hidden="true" />
      <div><strong>{i18n.t('ui.features.reservations.session_close_review_actions.baglanmasi_yoxlanmalidir_87b96f')}</strong>
        {reviewDueAt ? <span>{i18n.t('ui.features.reservations.session_close_review_actions.yoxlama_vaxti_64fbc1')} {formatReservationDateTime(reviewDueAt, timeZone || undefined)}</span> : null}
      </div>
    </div> : null}
    {reviewConfirmedAt ? <p className="session-close-review-confirmed">{i18n.t('ui.features.reservations.session_close_review_actions.xidmetin_davami_qeyd_edilib_44287b')} {formatReservationDateTime(reviewConfirmedAt, timeZone || undefined)}</p> : null}
    {sessionId !== null && showBill ? <SessionBillPanel sessionId={sessionId} revision={billRevision} onBillChange={updateBill} /> : null}
    {canComplete || canContinue ? <div className="session-close-review-buttons">
      {canComplete && !showBill ? <Button type="button" variant="secondary" onClick={() => setShowBill(true)}><CheckCircle2 size={17} />{i18n.t('ui.features.reservations.session_close_review_actions.hesabi_yoxla_f100b8')}</Button> : null}
      {canComplete && showBill ? <Button type="button" disabled={busy || !bill?.canClose} onClick={() => { setError(''); setDialog('complete') }} title={!bill?.canClose ?i18n.t('ui.features.reservations.session_close_review_actions.yalniz_hesablasma_tamamlandiqdan_sonra_26733c') : undefined}><CheckCircle2 size={17} />{i18n.t('ui.features.reservations.session_close_review_actions.xidmeti_bitir_4c724c')}</Button> : null}
      {canContinue ? <Button type="button" variant="secondary" disabled={busy} onClick={() => { setError(''); setDialog('continue') }}><Clock3 size={17} />{i18n.t('ui.features.reservations.session_close_review_actions.xidmet_davam_edir_25ab84')}</Button> : null}
    </div> : null}
    {error && !dialog ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    <ReservationReasonDialog isOpen={dialog === 'complete'} title={i18n.t('ui.features.reservations.session_close_review_actions.masa_xidmeti_bitirilsin_4f200d')} description={i18n.t('ui.features.reservations.session_close_review_actions.qonaqlarin_masadan_ayrildigini_ve_hesa_aabcca')} confirmLabel={i18n.t('ui.features.reservations.session_close_review_actions.xidmeti_bitir_4c724c')} confirmVariant="primary" isSubmitting={busy} error={dialog === 'complete' ? error : ''} requireReason={false} showReason={false} onClose={() => { if (!busy) setDialog(null) }} onConfirm={() => void complete()} />
    <SessionContinueDialog isOpen={dialog === 'continue'} isSubmitting={busy} error={dialog === 'continue' ? error : ''} onClose={() => { if (!busy) setDialog(null) }} onConfirm={(reviewAgainAt, reason) => void continueService(reviewAgainAt, reason)} />
  </div>
}
