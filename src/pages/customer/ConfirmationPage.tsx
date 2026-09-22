import { CheckCircle2 } from 'lucide-react'
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReservationReasonDialog } from '../../features/reservations/ReservationReasonDialog'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import type { WorkflowAction } from '../../entities/types'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
import { ReservationPaymentProofPanel } from '../../features/reservations/ReservationPaymentProofPanel'
import { ReservationHistoryTimeline } from '../../features/reservations/ReservationHistoryTimeline'
import type { ReservationHistoryResponse } from '../../shared/api/ecafeApi'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'

export function ConfirmationPage() {
  const [searchParams] = useSearchParams()
  const reservationId = searchParams.get('reservationId')
  const [reloadKey, setReloadKey] = useState(0)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const { data: reservation, error, isLoading } = useAsyncData(
    () => reservationId ? ecafeApi.reservations.getById(reservationId) : Promise.resolve(null),
    null,
    [reservationId, reloadKey],
  )
  const { data: workflowActions } = useAsyncData<WorkflowAction[]>(
    () => reservation && reservationId
      ? ecafeApi.workflow.actions({
          flowCode: 'reservation',
          statusId: reservation.statusId,
          restaurantId: String(reservation.restaurantId),
          entityId: reservationId,
        })
      : Promise.resolve([]),
    [],
    [reservationId, reservation?.statusId, reservation?.restaurantId, reloadKey],
  )
  const { data: history } = useAsyncData<ReservationHistoryResponse | null>(
    () => reservationId ? ecafeApi.reservations.getHistory(reservationId) : Promise.resolve(null),
    null,
    [reservationId, reloadKey],
  )

  const cancelAction = workflowActions.find((action) => action.code === 'cancel')

  async function cancelReservation(reason: string) {
    if (!reservationId) {
      return
    }

    setCancelError('')
    setIsCancelling(true)
    try {
      await ecafeApi.reservations.cancel(reservationId, reason)
      setIsCancelDialogOpen(false)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setCancelError(normalizeCaughtApiError(err, 'Rezervasiya ləğv edilmədi.').message)
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <main className="center-page">
      <article className="success-panel">
        <CheckCircle2 size={56} />
        <h1>{reservationId ? 'Rezervasiya qeydə alındı' : 'Sifariş qeydə alındı'}</h1>
        <p>
          {reservationId
            ? `Rezervasiya #${reservationId} ödəniş gözləyir. Menecer ödəniş təsdiqi üçün sizinlə əlaqə saxlayacaq.`
            : 'Sifariş məlumatları restorana göndərildi.'}
        </p>
        {reservationId && isLoading ? <p className="online-only">Rezervasiya detalları yüklənir...</p> : null}
        {reservationId && error ? <p className="reservation-availability-message danger">Rezervasiya detalları yüklənmədi.</p> : null}
        {reservation ? (
          <>
            <dl className="reservation-confirmation-details">
              <div><dt>Tarix və saat</dt><dd>{formatReservationDateTime(reservation.reservedAt)}</dd></div>
              <div><dt>Masa</dt><dd>#{reservation.tableId}</dd></div>
              <div><dt>Qonaq sayı</dt><dd>{reservation.peopleCount} nəfər</dd></div>
              <div><dt>Status</dt><dd>{getReservationStatusPresentation(reservation.status).label}</dd></div>
              <div><dt>Depozit</dt><dd>{reservation.depositAmount.toFixed(2)} AZN</dd></div>
              {reservation.holdExpiresAt ? <div><dt>Ödəniş üçün son vaxt</dt><dd>{formatReservationDateTime(reservation.holdExpiresAt)}</dd></div> : null}
            </dl>

            {reservation.latestPaymentInstruction && isReservationAwaitingPayment(reservation.status) ? (
              <ReservationPaymentProofPanel
                restaurantId={String(reservation.restaurantId)}
                reservationId={String(reservation.id)}
                amount={reservation.latestPaymentInstruction.amount || reservation.depositAmount}
              />
            ) : null}
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
            <ReservationHistoryTimeline items={history?.items || []} />
          </>
        ) : null}
        <ButtonLink to={reservation ? `/tracking/${reservation.id}` : '/reservations'}>Rezervasiyanı izlə</ButtonLink>
      </article>
      <ReservationReasonDialog
        confirmLabel="Rezervasiyanı ləğv et"
        description="Rezervasiya ləğv edildikdən sonra masa üçün yaradılmış hold aradan qaldırılacaq."
        error={cancelError}
        isOpen={isCancelDialogOpen}
        isSubmitting={isCancelling}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={(reason) => {
          void cancelReservation(reason)
        }}
        title="Rezervasiyanı ləğv edirsiniz?"
      />
    </main>
  )
}
