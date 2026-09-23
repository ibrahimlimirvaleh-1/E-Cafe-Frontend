import { ArrowRight, CalendarDays, Clock3, MapPin, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation, isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
import { ReservationPaymentProofPanel } from '../../features/reservations/ReservationPaymentProofPanel'

const emptyPage: PaginatedResponse<ReservationResponse> = {
  items: [],
  pageIndex: 1,
  totalPages: 1,
  totalCount: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}

export function MyReservationsPage() {
  const [reloadKey, setReloadKey] = useState(0)
  const { data, error, isLoading } = useAsyncData(
    () => ecafeApi.reservations.listMine({ pageNumber: 1, pageSize: 20 }),
    emptyPage,
    [reloadKey],
  )

  const reservationSummary = useMemo(() => {
    const activeCount = data.items.filter((reservation) => getReservationStatusPresentation(reservation.status).tone !== 'danger').length
    const awaitingPaymentCount = data.items.filter((reservation) => isReservationAwaitingPayment(reservation.status)).length

    return {
      activeCount,
      awaitingPaymentCount,
      totalCount: data.totalCount,
    }
  }, [data.items, data.totalCount])

  return (
    <main className="page reservations-page">
      <PageHeader
        eyebrow="Hesab"
        title="Rezervasiyalarım"
        description="Rezervasiyalarınızı və ödəniş mərhələlərini izləyin."
      />

      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {isLoading ? <p className="online-only">Rezervasiyalar yüklənir...</p> : null}

      {!isLoading && !error && data.items.length > 0 ? (
        <section className="reservation-overview" aria-label="Rezervasiya xülasəsi">
          <div>
            <span>Aktiv</span>
            <strong>{reservationSummary.activeCount}</strong>
            <small>rezervasiya</small>
          </div>
          <div>
            <span>Ödəniş gözləyir</span>
            <strong>{reservationSummary.awaitingPaymentCount}</strong>
            <small>növbəti addım</small>
          </div>
          <div>
            <span>Ümumi</span>
            <strong>{reservationSummary.totalCount}</strong>
            <small>rezervasiya</small>
          </div>
        </section>
      ) : null}

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
          const presentation = getReservationStatusPresentation(reservation.status)

          return (
            <article className="customer-reservation-card" key={reservation.id}>
              <div className="customer-reservation-card-header">
                <div>
                  <span className="reservation-card-kicker">Rezervasiya #{reservation.id}</span>
                  <h2>{reservation.restaurantName || 'Restoran rezervasiyası'}</h2>
                </div>
                <div className="reservation-card-status">
                  <Badge tone={presentation.tone}>{presentation.label}</Badge>
                  <span>{formatReservationDateTime(reservation.reservedAt)}</span>
                </div>
              </div>

              <div className="customer-reservation-meta">
                <span className="reservation-meta-item"><CalendarDays size={17} /><span><small>Gəliş vaxtı</small><b>{formatReservationDateTime(reservation.reservedAt)}</b></span></span>
                <span className="reservation-meta-item"><MapPin size={17} /><span><small>Masa</small><b>{reservation.tableName || `Masa ${reservation.tableId}`}</b></span></span>
                <span className="reservation-meta-item"><Users size={17} /><span><small>Qonaq sayı</small><b>{reservation.peopleCount} nəfər</b></span></span>
                <span className="reservation-meta-item"><Clock3 size={17} /><span><small>Depozit</small><b>{reservation.depositAmount.toFixed(2)} AZN</b></span></span>
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
                  statusId={reservation.statusId}
                  workflowFlowCode={reservation.workflowFlowCode}
                  onSubmitted={() => setReloadKey((value) => value + 1)}
                />
              ) : null}

              <div className="customer-reservation-card-footer">
                <span className="reservation-card-deadline">
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
