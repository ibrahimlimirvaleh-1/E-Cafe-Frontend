import { CheckCircle2, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { ReservationReasonDialog } from './ReservationReasonDialog'
import { SessionContinueDialog } from './SessionContinueDialog'
import './session-close-review.css'

type Props = {
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
}

export function SessionCloseReviewActions({ restaurantId, reservationId, sessionId, canComplete, completeAs, canContinue, requiresReview, reviewDueAt, reviewConfirmedAt, timeZone, onChanged }: Props) {
  const [dialog, setDialog] = useState<'complete' | 'continue' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Bağlama və davam qərarları yalnız açıq istifadəçi təsdiqindən sonra göndərilir.
  async function complete() {
    if (busy || !canComplete || reservationId === null) return
    setBusy(true)
    setError('')
    try {
      if (completeAs === 'waiter') await ecafeApi.reservations.completeService(restaurantId, String(reservationId))
      else await ecafeApi.reservations.completeSession(restaurantId, String(reservationId))
      setDialog(null)
      onChanged('Masa xidməti bitirildi.')
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (caught) {
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

  if (!requiresReview && !canComplete && !reviewConfirmedAt) return null

  return <div className="session-close-review">
    {requiresReview ? <div className="session-close-review-warning" role="status">
      <Clock3 size={18} aria-hidden="true" />
      <div><strong>Bağlanması yoxlanmalıdır</strong>
        {reviewDueAt ? <span>Yoxlama vaxtı: {formatReservationDateTime(reviewDueAt, timeZone || undefined)}</span> : null}
      </div>
    </div> : null}
    {reviewConfirmedAt ? <p className="session-close-review-confirmed">Xidmətin davamı qeyd edilib: {formatReservationDateTime(reviewConfirmedAt, timeZone || undefined)}</p> : null}
    {canComplete || canContinue ? <div className="session-close-review-buttons">
      {canComplete ? <Button type="button" disabled={busy} onClick={() => { setError(''); setDialog('complete') }}><CheckCircle2 size={17} />Xidməti bitir</Button> : null}
      {canContinue ? <Button type="button" variant="secondary" disabled={busy} onClick={() => { setError(''); setDialog('continue') }}><Clock3 size={17} />Xidmət davam edir</Button> : null}
    </div> : null}
    {error && !dialog ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    <ReservationReasonDialog isOpen={dialog === 'complete'} title="Masa xidməti bitirilsin?" description="Qonaqların masadan ayrıldığını yoxlayın. Təsdiqdən sonra açıq masa sessiyası bağlanacaq." confirmLabel="Xidməti bitir" confirmVariant="primary" isSubmitting={busy} error={dialog === 'complete' ? error : ''} requireReason={false} showReason={false} onClose={() => { if (!busy) setDialog(null) }} onConfirm={() => void complete()} />
    <SessionContinueDialog isOpen={dialog === 'continue'} isSubmitting={busy} error={dialog === 'continue' ? error : ''} onClose={() => { if (!busy) setDialog(null) }} onConfirm={(reviewAgainAt, reason) => void continueService(reviewAgainAt, reason)} />
  </div>
}
