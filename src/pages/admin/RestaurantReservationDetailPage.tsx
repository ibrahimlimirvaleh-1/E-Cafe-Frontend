import { CalendarDays, Clock3, Users } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ReservationPaymentInstructionPanel } from '../../features/reservations/ReservationPaymentInstructionPanel'
import { ReservationHistoryTimeline } from '../../features/reservations/ReservationHistoryTimeline'
import type { ReservationHistoryResponse, ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import type { WorkflowAction } from '../../entities/types'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'

export function RestaurantReservationDetailPage() {
  const { user } = useAuth()
  const { reservationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurantId') || user?.restaurantId || user?.profiles[0]?.restaurantId || ''
  const { data: reservation, error, isLoading } = useAsyncData<ReservationResponse | null>(
    () => restaurantId && reservationId ? ecafeApi.reservations.getForRestaurant(restaurantId, reservationId) : Promise.resolve(null),
    null,
    [restaurantId, reservationId],
  )
  const { data: workflowActions } = useAsyncData<WorkflowAction[]>(
    () => reservation && restaurantId && reservationId
      ? ecafeApi.workflow.actions({
          flowCode: 'reservation',
          statusId: reservation.statusId,
          restaurantId,
          entityId: reservationId,
        })
      : Promise.resolve([]),
    [],
    [restaurantId, reservationId, reservation?.statusId],
  )
  const { data: history } = useAsyncData<ReservationHistoryResponse | null>(
    () => restaurantId && reservationId
      ? ecafeApi.reservations.getHistoryForRestaurant(restaurantId, reservationId)
      : Promise.resolve(null),
    null,
    [restaurantId, reservationId],
  )
  const canSendPaymentInstruction = workflowActions.some((action) => action.code === 'sendPaymentInstruction')

  if (isLoading) return <main className="admin-page narrow"><p className="online-only">Rezervasiya yüklənir...</p></main>
  if (error || !reservation) {
    return <main className="admin-page narrow"><StatusMessage tone="danger" autoHideMs={false}>{error || 'Rezervasiya tapılmadı.'}</StatusMessage></main>
  }

  const presentation = getReservationStatusPresentation(reservation.status)

  return (
    <main className="admin-page narrow reservation-detail-page">
      <PageHeader eyebrow="Rezervasiya detalı" title={`Rezervasiya #${reservation.id}`} description={reservation.customerName || 'Müştəri rezervasiyası'} />
      <section className="reservation-detail-card">
        <div className="reservation-detail-card-header">
          <div>
            <span className="reservation-card-kicker">{reservation.restaurantName || 'Restoran'}</span>
            <h2>{reservation.tableName || `Masa ${reservation.tableId}`}</h2>
          </div>
          <Badge tone={presentation.tone}>{presentation.label}</Badge>
        </div>
        <div className="reservation-detail-grid">
          <div><CalendarDays size={17} /><span><small>Gəliş vaxtı</small><strong>{formatReservationDateTime(reservation.reservedAt)}</strong></span></div>
          <div><Users size={17} /><span><small>Qonaq sayı</small><strong>{reservation.peopleCount} nəfər</strong></span></div>
          <div><Clock3 size={17} /><span><small>Depozit</small><strong>{reservation.depositAmount.toFixed(2)} AZN</strong></span></div>
          <div><Clock3 size={17} /><span><small>{reservation.holdExpiresAt ? 'Ödəniş üçün son vaxt' : 'Cavab üçün son vaxt'}</small><strong>{formatReservationDateTime(reservation.holdExpiresAt || reservation.restaurantResponseExpiresAt)}</strong></span></div>
        </div>
        {reservation.latestPaymentInstruction ? (
          <div className="reservation-payment-note">
            <strong>Son göndərilən ödəniş məlumatı</strong>
            <p>{reservation.latestPaymentInstruction.displayText}</p>
            <small>{formatReservationDateTime(reservation.latestPaymentInstruction.sentAt)}</small>
          </div>
        ) : null}
        <div className="action-row">
          <ButtonLink variant="secondary" to={`/admin/reservations?restaurantId=${restaurantId}`}>Siyahıya qayıt</ButtonLink>
        </div>
      </section>
      <ReservationHistoryTimeline items={history?.items || []} />
      {canSendPaymentInstruction ? (
        <ReservationPaymentInstructionPanel
          restaurantId={restaurantId}
          reservationId={String(reservation.id)}
          amount={`${reservation.depositAmount.toFixed(2)} AZN`}
        />
      ) : null}
    </main>
  )
}
