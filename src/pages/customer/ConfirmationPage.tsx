import { Ban, CheckCircle2 } from 'lucide-react'
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
import { Badge } from '../../shared/ui/Badge'

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
    () => reservation && reservationId && reservation.workflowFlowCode
      ? ecafeApi.workflow.actions({
          flowCode: reservation.workflowFlowCode,
          statusId: reservation.statusId,
          restaurantId: String(reservation.restaurantId),
          entityId: reservationId,
        })
      : Promise.resolve([]),
    [],
    [reservationId, reservation?.workflowFlowCode, reservation?.statusId, reservation?.restaurantId, reloadKey],
  )
  const { data: history } = useAsyncData<ReservationHistoryResponse | null>(
    () => reservationId ? ecafeApi.reservations.getHistory(reservationId) : Promise.resolve(null),
    null,
    [reservationId, reloadKey],
  )

  const cancelAction = workflowActions.find((action) => action.code === 'cancel')
  const submitPaymentProofAction = workflowActions.find((action) => action.code === 'submitPaymentProof')

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

  return (
    <main className="center-page reservation-confirmation-page">
      <div className="reservation-confirmation-layout">
        <article className="success-panel reservation-confirmation-panel">
          <div className="reservation-confirmation-icon"><CheckCircle2 size={28} /></div>
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
          {reservationId && error ? <p className="reservation-availability-message danger">Rezervasiya detalları yüklənmədi.</p> : null}
          {reservation ? (
            <>
              <dl className="reservation-confirmation-details">
                <div><dt>Tarix və saat</dt><dd>{formatReservationDateTime(reservation.reservedAt)}</dd></div>
                <div><dt>Masa</dt><dd>{reservation.tableName || `Masa ${reservation.tableId}`}</dd></div>
                <div><dt>Qonaq sayı</dt><dd>{reservation.peopleCount} nəfər</dd></div>
                <div><dt>Status</dt><dd>{getReservationStatusPresentation(reservation.status).label}</dd></div>
                <div><dt>Depozit</dt><dd>{reservation.depositAmount.toFixed(2)} AZN</dd></div>
                {reservation.mustVacateAt ? <div><dt>Masanı təhvil vaxtı</dt><dd>{formatReservationDateTime(reservation.mustVacateAt)}</dd></div> : null}
                {reservation.holdExpiresAt ? <div><dt>Ödəniş üçün son vaxt</dt><dd>{formatReservationDateTime(reservation.holdExpiresAt)}</dd></div> : null}
              </dl>

              {reservation.latestPaymentInstruction && isReservationAwaitingPayment(reservation.status) ? (
                <ReservationPaymentProofPanel
                  restaurantId={String(reservation.restaurantId)}
                  reservationId={String(reservation.id)}
                  amount={reservation.latestPaymentInstruction.amount || reservation.depositAmount}
                  action={submitPaymentProofAction}
                  statusId={reservation.statusId}
                  workflowFlowCode={reservation.workflowFlowCode}
                  onSubmitted={() => setReloadKey((value) => value + 1)}
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
            </>
          ) : null}
        </article>

        <aside className="reservation-confirmation-side">
          {reservation ? <ReservationHistoryTimeline items={history?.items || []} /> : null}
          <ButtonLink to={reservation ? `/tracking/${reservation.id}` : '/reservations'}>Rezervasiyanı izlə</ButtonLink>
        </aside>
      </div>
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
