import { ArrowRight, CalendarDays, Clock3, MapPin, Users } from 'lucide-react'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import type { StatusTone } from '../../entities/types'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
import { ReservationPaymentProofPanel } from '../../features/reservations/ReservationPaymentProofPanel'

const emptyPage: PaginatedResponse<ReservationResponse> = {
  items: [],
  pageIndex: 1,
  totalPages: 1,
  totalCount: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}

function statusPresentation(status: string): { label: string; tone: StatusTone } {
  const normalized = status.toLowerCase()

  if (normalized.includes('restoran cavabı')) return { label: 'Restoran cavabı gözlənilir', tone: 'warning' }
  if (normalized.includes('pending') || normalized.includes('payment')) {
    return { label: 'Ödəniş gözləyir', tone: 'warning' }
  }

  if (normalized.includes('reserved') || normalized.includes('confirmed')) {
    return { label: 'Təsdiqlənib', tone: 'success' }
  }

  if (normalized.includes('expired')) return { label: 'Vaxtı bitib', tone: 'danger' }
  if (normalized.includes('cancel')) return { label: 'Ləğv edilib', tone: 'danger' }
  if (normalized.includes('reject')) return { label: 'Rədd edilib', tone: 'danger' }

  return { label: status || 'Gözləmədə', tone: 'neutral' }
}

export function MyReservationsPage() {
  const { data, error, isLoading } = useAsyncData(
    () => ecafeApi.reservations.listMine({ pageNumber: 1, pageSize: 20 }),
    emptyPage,
    [],
  )

  return (
    <main className="page reservations-page">
      <PageHeader
        eyebrow="Hesab"
        title="Rezervasiyalarım"
        description="Rezervasiyalarınızın statusunu və ödəniş məlumatlarını buradan izləyin."
      />

      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {isLoading ? <p className="online-only">Rezervasiyalar yüklənir...</p> : null}

      {!isLoading && !error && data.items.length === 0 ? (
        <section className="reservation-empty-state">
          <CalendarDays size={28} />
          <h2>Hələ rezervasiyanız yoxdur</h2>
          <p>Restoran seçərək uyğun masa üçün rezervasiya yarada bilərsiniz.</p>
          <ButtonLink to="/">Restoranlara bax</ButtonLink>
        </section>
      ) : null}

      <section className="customer-reservation-list" aria-label="Rezervasiya siyahısı">
        {data.items.map((reservation) => {
          const presentation = statusPresentation(reservation.status)

          return (
            <article className="customer-reservation-card" key={reservation.id}>
              <div className="customer-reservation-card-header">
                <div>
                  <span className="reservation-card-kicker">Rezervasiya #{reservation.id}</span>
                  <h2>{reservation.restaurantName || 'Restoran rezervasiyası'}</h2>
                </div>
                <Badge tone={presentation.tone}>{presentation.label}</Badge>
              </div>

              <div className="customer-reservation-meta">
                <span><CalendarDays size={17} />{formatReservationDateTime(reservation.reservedAt)}</span>
                <span><MapPin size={17} />{reservation.tableName || `Masa ${reservation.tableId}`}</span>
                <span><Users size={17} />{reservation.peopleCount} nəfər</span>
                <span><Clock3 size={17} />{reservation.depositAmount.toFixed(2)} AZN depozit</span>
              </div>

              {reservation.latestPaymentInstruction ? (
                <div className="reservation-payment-note">
                  <strong>Ödəniş məlumatı</strong>
                  <p>{reservation.latestPaymentInstruction.displayText}</p>
                  <small>{formatReservationDateTime(reservation.latestPaymentInstruction.sentAt)}</small>
                </div>
              ) : null}

              {reservation.latestPaymentInstruction && isReservationAwaitingPayment(reservation.status) ? (
                <ReservationPaymentProofPanel
                  restaurantId={String(reservation.restaurantId)}
                  reservationId={String(reservation.id)}
                  amount={reservation.latestPaymentInstruction.amount || reservation.depositAmount}
                />
              ) : null}

              <div className="customer-reservation-card-footer">
                <span>
                  {reservation.holdExpiresAt
                    ? `Ödəniş üçün son vaxt: ${formatReservationDateTime(reservation.holdExpiresAt)}`
                    : reservation.restaurantResponseExpiresAt
                      ? `Cavab üçün son vaxt: ${formatReservationDateTime(reservation.restaurantResponseExpiresAt)}`
                      : 'Rezervasiya məlumatları yenilənir'}
                </span>
                <ButtonLink variant="secondary" to={`/confirmation?reservationId=${reservation.id}`}>
                  Detallara bax <ArrowRight size={16} />
                </ButtonLink>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
