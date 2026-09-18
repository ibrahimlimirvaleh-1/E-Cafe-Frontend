import { ArrowRight, CalendarDays, Clock3, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import type { StatusTone } from '../../entities/types'

const emptyPage: PaginatedResponse<ReservationResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasPreviousPage: false, hasNextPage: false,
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
}

function statusPresentation(status: string): { label: string; tone: StatusTone } {
  const normalized = status.toLowerCase()
  if (normalized.includes('pending') || normalized.includes('payment')) return { label: 'Ödəniş gözləyir', tone: 'warning' }
  if (normalized.includes('reserved') || normalized.includes('confirmed')) return { label: 'Təsdiqlənib', tone: 'success' }
  if (normalized.includes('expired')) return { label: 'Vaxtı bitib', tone: 'danger' }
  if (normalized.includes('cancel') || normalized.includes('reject')) return { label: 'Bağlanıb', tone: 'danger' }
  return { label: status || 'Gözləmədə', tone: 'neutral' }
}

export function RestaurantReservationsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurantId') || user?.restaurantId || user?.profiles[0]?.restaurantId || ''
  const { data, error, isLoading } = useAsyncData(
    () => restaurantId ? ecafeApi.reservations.listForRestaurant(restaurantId, { pageNumber: 1, pageSize: 50 }) : Promise.resolve(emptyPage),
    emptyPage,
    [restaurantId],
  )

  return (
    <main className="admin-page reservations-admin-page">
      <PageHeader
        eyebrow="Restoran"
        title="Rezervasiyalar"
        description="Müştərilərin rezervasiyalarını və ödəniş gözləyən sorğuları idarə edin."
      />

      {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>Rezervasiyaları görmək üçün restoran seçin.</StatusMessage> : null}
      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {isLoading ? <p className="online-only">Rezervasiyalar yüklənir...</p> : null}

      {!isLoading && !error && data.items.length === 0 ? (
        <section className="reservation-empty-state reservation-empty-state-admin">
          <CalendarDays size={28} />
          <h2>Rezervasiya yoxdur</h2>
          <p>Bu restoran üçün yeni rezervasiya yarandıqda burada görünəcək.</p>
        </section>
      ) : null}

      <section className="admin-reservation-list" aria-label="Restoran rezervasiyaları">
        {data.items.map((reservation) => {
          const presentation = statusPresentation(reservation.status)

          return (
            <article className="admin-reservation-row" key={reservation.id}>
              <div className="admin-reservation-row-main">
                <span className="reservation-card-kicker">Rezervasiya #{reservation.id}</span>
                <h2>{reservation.customerName || 'Müştəri'}</h2>
                <span className="admin-reservation-secondary">{reservation.tableName || `Masa ${reservation.tableId}`}</span>
              </div>
              <div className="admin-reservation-row-meta">
                <span><CalendarDays size={16} />{formatDate(reservation.reservedAt)}</span>
                <span><Users size={16} />{reservation.peopleCount} nəfər</span>
                <span><Clock3 size={16} />{reservation.depositAmount.toFixed(2)} AZN</span>
              </div>
              <div className="admin-reservation-row-action">
                <Badge tone={presentation.tone}>{presentation.label}</Badge>
                <ButtonLink variant="secondary" to={`/admin/reservations/${reservation.id}?restaurantId=${restaurantId}`}>
                  Detal <ArrowRight size={16} />
                </ButtonLink>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
