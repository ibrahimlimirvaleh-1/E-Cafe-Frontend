import { CalendarDays, Clock3, Users } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ReservationPaymentInstructionPanel } from '../../features/reservations/ReservationPaymentInstructionPanel'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { getRestaurantRoleId, hasPermission, hasPermissionForRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import type { StatusTone } from '../../entities/types'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'

function statusPresentation(status: string): { label: string; tone: StatusTone } {
  const normalized = status.toLowerCase()
  if (normalized.includes('pending') || normalized.includes('payment')) return { label: 'Ödəniş gözləyir', tone: 'warning' }
  if (normalized.includes('reserved') || normalized.includes('confirmed')) return { label: 'Təsdiqlənib', tone: 'success' }
  if (normalized.includes('expired') || normalized.includes('cancel') || normalized.includes('reject')) return { label: 'Bağlanıb', tone: 'danger' }
  return { label: status || 'Gözləmədə', tone: 'neutral' }
}

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
  const roleId = getRestaurantRoleId(user, restaurantId)
  const canSendPaymentInstruction = hasPermission(user, 'ManageReservations') || hasPermissionForRole(roleId, 'ManageReservations')

  if (isLoading) return <main className="admin-page narrow"><p className="online-only">Rezervasiya yüklənir...</p></main>
  if (error || !reservation) {
    return <main className="admin-page narrow"><StatusMessage tone="danger" autoHideMs={false}>{error || 'Rezervasiya tapılmadı.'}</StatusMessage></main>
  }

  const presentation = statusPresentation(reservation.status)

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
          <div><Clock3 size={17} /><span><small>Ödəniş üçün son vaxt</small><strong>{formatReservationDateTime(reservation.holdExpiresAt)}</strong></span></div>
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
