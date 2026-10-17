import { Ban, CalendarDays, CheckCircle2, CircleAlert, Clock3, ReceiptText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReservationReasonDialog } from '../../features/reservations/ReservationReasonDialog'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import type { WorkflowAction } from '../../entities/types'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationDepartureReasonLabel, isReservationConfirmed } from '../../shared/lib/reservationStatus'
import { CustomerDepositCheckoutPanel } from '../../features/reservations/CustomerDepositCheckoutPanel'
import { ReservationHistoryTimeline } from '../../features/reservations/ReservationHistoryTimeline'
import { ReservationRefundPanel } from '../../features/reservations/ReservationRefundPanel'
import { ReservationLateArrivalPanel } from '../../features/reservations/ReservationLateArrivalPanel'
import { ReservationWaitingSummary } from '../../features/reservations/ReservationWaitingSummary'
import type { ReservationHistoryResponse } from '../../shared/api/ecafeApi'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'
import { Badge } from '../../shared/ui/Badge'
import { ScheduleOfferPanel } from '../../features/reservations/ScheduleOfferPanel'

export function ConfirmationPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const reservationId = searchParams.get('reservationId')
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const onRefresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', onRefresh)
  }, [])
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [cancelNow, setCancelNow] = useState(Date.now())
  useEffect(() => {
    if (!isCancelDialogOpen) return
    setCancelNow(Date.now())
    const timer = window.setInterval(() => setCancelNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isCancelDialogOpen])
  const [showDepositWaiverNotice, setShowDepositWaiverNotice] = useState(false)
  const previousReservationRef = useRef<{ id: number; depositAmount: number } | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const reservationScope = `${user?.userId || ''}:${reservationId || ''}`
  const { data: reservation, error, hasData, isLoading } = useKeyedAsyncData(
    () => reservationId ? ecafeApi.reservations.getById(reservationId) : Promise.resolve(null),
    null,
    reservationScope,
    [user?.userId, reservationId, reloadKey],
  )
  const isWaiting = Boolean(reservation?.waiting || reservation?.requiresReceptionReview)
  useEffect(() => {
    if (!isWaiting) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setReloadKey((value) => value + 1)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [isWaiting])
  useEffect(() => {
    if (!reservation) return
    const previous = previousReservationRef.current
    if (previous?.id === reservation.id && previous.depositAmount > 0 && reservation.depositAmount === 0) {
      setShowDepositWaiverNotice(true)
    }
    previousReservationRef.current = { id: reservation.id, depositAmount: reservation.depositAmount }
  }, [reservation])
  const actionsScope = `${reservationScope}:${reservation?.workflowFlowCode || ''}:${reservation?.statusId || ''}:${reservation?.restaurantId || ''}`
  const { data: workflowActions } = useKeyedAsyncData<WorkflowAction[]>(
    () => reservation && reservationId && reservation.workflowFlowCode
      ? ecafeApi.workflow.actions({
          flowCode: reservation.workflowFlowCode,
          statusId: reservation.statusId,
          restaurantId: String(reservation.restaurantId),
          entityId: reservationId,
        })
      : Promise.resolve([]),
    [],
    actionsScope,
    [user?.userId, reservationId, reservation?.workflowFlowCode, reservation?.statusId, reservation?.restaurantId, reloadKey],
  )
  const { data: history } = useKeyedAsyncData<ReservationHistoryResponse | null>(
    () => reservationId ? ecafeApi.reservations.getHistory(reservationId) : Promise.resolve(null),
    null,
    reservationScope,
    [user?.userId, reservationId, reloadKey],
  )

  const cancelAction = workflowActions.find((action) => action.code === 'cancel')

  async function cancelReservation(reason: string) {
    if (!reservationId || !cancelAction) {
      return
    }

    setCancelError('')
    setIsCancelling(true)
    try {
      await ecafeApi.workflow.executeAction({
        action: cancelAction,
        body: reason ? { reason } : undefined,
      })
      setIsCancelDialogOpen(false)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setCancelError(normalizeCaughtApiError(err, 'Rezervasiya ləğv edilmədi.').message)
    } finally {
      setIsCancelling(false)
    }
  }

  const reservationPresentation = reservation
    ? getReservationStatusPresentation(reservation.status)
    : null
  const statusTone = reservationPresentation?.tone || 'neutral'
  const StatusIcon = statusTone === 'success'
    ? CheckCircle2
    : statusTone === 'danger'
      ? CircleAlert
      : statusTone === 'warning'
        ? Clock3
        : statusTone === 'info'
          ? ReceiptText
          : CalendarDays

  return (
    <main className="center-page reservation-confirmation-page">
      <div className="reservation-confirmation-layout">
        <article className="success-panel reservation-confirmation-panel">
          <div className={`reservation-confirmation-icon is-${statusTone}`}><StatusIcon size={28} /></div>
          <div className="reservation-confirmation-heading">
            <span className="section-eyebrow">REZERVASİYA DETALI</span>
            <h1>{reservationId ? `Rezervasiya #${reservationId}` : 'Sifariş qeydə alındı'}</h1>
            {reservation ? <p>{reservation.restaurantName || 'Restoran rezervasiyası'}</p> : null}
          </div>
          {reservationPresentation ? <Badge tone={reservationPresentation.tone}>{reservationPresentation.label}</Badge> : null}
          <p>
            {reservationId
              ? reservationPresentation?.tone === 'success'
                ? 'Rezervasiyanın statusu yeniləndi. Detalları və tarixçəni aşağıda görə bilərsiniz.'
                : 'Rezervasiyanın statusunu və növbəti addımı aşağıda görə bilərsiniz.'
              : 'Sifariş məlumatları restorana göndərildi.'}
          </p>
          {reservationId && isLoading ? <p className="online-only">Rezervasiya detalları yüklənir...</p> : null}
          {reservationId && error ? <p className="reservation-availability-message danger">{hasData ? 'Son məlumat yenilənmədi. Yenidən yoxlanacaq.' : 'Rezervasiya detalları yüklənmədi.'}</p> : null}
          {reservation ? (
            <>
              <dl className="reservation-confirmation-details">
                <div><dt>Tarix və saat</dt><dd>{formatReservationDateTime(reservation.reservedAt, reservation.timeZone || undefined)}</dd></div>
                <div><dt>Masa</dt><dd>{reservation.tableName || `Masa ${reservation.tableId}`}</dd></div>
                <div><dt>Qonaq sayı</dt><dd>{reservation.peopleCount} nəfər</dd></div>
                <div><dt>Status</dt><dd>{getReservationStatusPresentation(reservation.status).label}</dd></div>
                {reservation.departureReason ? <div><dt>Ayrılma səbəbi</dt><dd>{getReservationDepartureReasonLabel(reservation.departureReason)}</dd></div> : null}
                <div><dt>Depozit</dt><dd>{reservation.depositAmount > 0 ? `${reservation.depositAmount.toFixed(2)} AZN` : 'Tələb olunmur'}</dd></div>
                {!reservation.expectedArrivalAt && !reservation.arrivedAt && isReservationConfirmed(reservation.status) ? <div><dt>Gəliş üçün son vaxt</dt><dd>{formatReservationDateTime(reservation.noShowDeadlineAt, reservation.timeZone || undefined)}</dd></div> : null}
                {reservation.mustVacateAt ? <div><dt>Masanı təhvil vaxtı</dt><dd>{formatReservationDateTime(reservation.mustVacateAt, reservation.timeZone || undefined)}</dd></div> : null}
                {reservation.holdExpiresAt ? <div><dt>Ödəniş üçün son vaxt</dt><dd>{formatReservationDateTime(reservation.holdExpiresAt)}</dd></div> : null}
              </dl>

              <ReservationWaitingSummary waiting={reservation.waiting} requiresReceptionReview={reservation.requiresReceptionReview} timeZone={reservation.timeZone} viewer="customer" />

              <ReservationLateArrivalPanel reservation={reservation} refreshKey={reloadKey} onChanged={() => setReloadKey((value) => value + 1)} />
              <ScheduleOfferPanel reservationId={String(reservation.id)} refreshKey={reloadKey}
                onChanged={() => setReloadKey((value) => value + 1)} />

              {reservation.depositAmount > 0 ? (
                <CustomerDepositCheckoutPanel
                  restaurantId={String(reservation.restaurantId)}
                  reservationId={String(reservation.id)}
                  amount={reservation.depositAmount}
                  onChanged={() => setReloadKey((value) => value + 1)}
                />
              ) : null}
              <ReservationRefundPanel
                reservationId={reservation.id}
                restaurantId={reservation.restaurantId}
                reservationStatusId={reservation.statusId}
                reservationFlowCode={reservation.workflowFlowCode}
                refundRequest={reservation.refundRequest}
              />
              {cancelAction ? (
                <div className="reservation-confirmation-actions">
                  <Button
                    onClick={() => {
                      setCancelError('')
                      setIsCancelDialogOpen(true)
                    }}
                    variant="danger"
                  >
                    <Ban size={17} />
                    {cancelAction.label}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </article>

        <aside className="reservation-confirmation-side">
          {reservation ? <ReservationHistoryTimeline items={history?.items || []} arrivedAt={history?.arrivedAt ?? reservation.arrivedAt} seatedAt={history?.seatedAt ?? reservation.seatedAt} requiresReceptionReview={reservation.requiresReceptionReview} timeZone={reservation.timeZone || undefined} /> : null}
          <ButtonLink to={reservation ? `/tracking/${reservation.id}` : '/reservations'}>Rezervasiyanı izlə</ButtonLink>
        </aside>
      </div>
      <ReservationReasonDialog
        confirmLabel="Rezervasiyanı ləğv et"
        description={reservation?.hasConfirmedDeposit
          ? reservation.canCancelWithRefund && new Date(reservation.refundCancellationDeadlineAt || '').getTime() > cancelNow
            ? `İndi ləğv etsəniz depozitin tam geri ödənişini tələb edə bilərsiniz. Geri ödəniş üçün son ləğv vaxtı: ${formatReservationDateTime(reservation.refundCancellationDeadlineAt)}. Pul ayrıca geri ödəniş prosesi ilə qaytarılır.`
            : 'Rezervasiya ləğv ediləcək və masa azad olacaq. Geri ödəniş üçün müddət bitdiyinə görə depozit qaytarılmayacaq.'
          : 'Rezervasiya ləğv ediləcək və masa azad olacaq.'}
        error={cancelError}
        isOpen={isCancelDialogOpen}
        isSubmitting={isCancelling}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={(reason) => {
          void cancelReservation(reason)
        }}
        showReason
        title="Rezervasiyanı ləğv edirsiniz?"
      />
      {showDepositWaiverNotice ? (
        <div className="modal-backdrop reservation-action-backdrop" role="presentation">
          <section aria-labelledby="deposit-waiver-notice-title" aria-modal="true" className="reservation-action-dialog" role="dialog">
            <div className="reservation-action-dialog-body">
              <h2 id="deposit-waiver-notice-title">Depozit tələbi ləğv edildi</h2>
              <p>Restoran bu rezervasiya üçün depozitdən imtina etdi. Rezervasiyanız depozitsiz təsdiqlənib, ödəniş etməyinizə ehtiyac yoxdur.</p>
            </div>
            <footer className="reservation-action-dialog-actions">
              <Button onClick={() => setShowDepositWaiverNotice(false)} type="button">Başa düşdüm</Button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  )
}
