import { CalendarDays, MapPin, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { ReservationHistoryTimeline } from '../../features/reservations/ReservationHistoryTimeline'
import { ReservationPaymentProofPanel } from '../../features/reservations/ReservationPaymentProofPanel'
import type { ReservationHistoryResponse, ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation, isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function TrackingPage() {
  const { token = '' } = useParams()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: reservation, error, isLoading } = useAsyncData<ReservationResponse | null>(
    async () => {
      if (/^\d+$/.test(token)) {
        return ecafeApi.reservations.getById(token)
      }

      const result = await ecafeApi.reservations.listMine({ pageNumber: 1, pageSize: 1 })
      return result.items[0] ?? null
    },
    null,
    [token, reloadKey],
  )
  const { data: history } = useAsyncData<ReservationHistoryResponse | null>(
    () => reservation ? ecafeApi.reservations.getHistory(String(reservation.id)) : Promise.resolve(null),
    null,
    [reservation?.id, reloadKey],
  )

  const presentation = reservation ? getReservationStatusPresentation(reservation.status) : null

  return (
    <main className="page tracking-page">
      <PageHeader
        eyebrow="Rezervasiya"
        title="Rezervasiyanı izlə"
        description="Statusu, ödənişi və proses tarixçəsini bir yerdə görün."
      />

      {isLoading ? <p className="online-only">Rezervasiya məlumatları yüklənir...</p> : null}
      {error ? <StatusMessage autoHideMs={false} tone="danger">{error}</StatusMessage> : null}

      {!isLoading && !error && !reservation ? (
        <section className="tracking-panel reservation-empty-state">
          <CalendarDays size={28} />
          <h2>İzlənəcək rezervasiya yoxdur</h2>
          <p>Rezervasiya yaratdıqdan sonra onun statusunu burada görə bilərsiniz.</p>
          <ButtonLink to="/reservations">Rezervasiyalarım</ButtonLink>
        </section>
      ) : null}

      {reservation && presentation ? (
        <>
          <section className="tracking-panel">
            <header className="tracking-hero">
              <div>
                <span className="tracking-eyebrow">REZERVASİYA #{reservation.id}</span>
                <h2>{reservation.restaurantName || 'Restoran rezervasiyası'}</h2>
                <p>{reservation.tableName || `Masa ${reservation.tableId}`}</p>
              </div>
              <Badge tone={presentation.tone}>{presentation.label}</Badge>
            </header>

            <div className="tracking-content-grid">
              <section className="tracking-items" aria-label="Rezervasiya məlumatları">
                <div className="tracking-section-heading">
                  <span>REZERVASİYA MƏLUMATLARI</span>
                  <strong>{reservation.peopleCount} nəfər</strong>
                </div>
                <ul>
                  <li><CalendarDays size={17} />{formatReservationDateTime(reservation.reservedAt)}</li>
                  <li><MapPin size={17} />{reservation.tableName || `Masa ${reservation.tableId}`}</li>
                  <li><Users size={17} />{reservation.peopleCount} nəfər</li>
                </ul>
              </section>
              <section className="tracking-total" aria-label="Depozit məlumatı">
                <span>DEPOZİT</span>
                <strong>{reservation.depositAmount.toFixed(2)} AZN</strong>
                <small>
                  {reservation.holdExpiresAt
                    ? `Ödəniş üçün son vaxt: ${formatReservationDateTime(reservation.holdExpiresAt)}`
                    : reservation.restaurantResponseExpiresAt
                      ? `Cavab üçün son vaxt: ${formatReservationDateTime(reservation.restaurantResponseExpiresAt)}`
                      : 'Əlavə ödəniş müddəti yoxdur'}
                </small>
              </section>
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

            <div className="tracking-page-actions">
              <ButtonLink to={`/confirmation?reservationId=${reservation.id}`}>Rezervasiya detallarına bax</ButtonLink>
            </div>
          </section>

          <ReservationHistoryTimeline items={history?.items || []} />
        </>
      ) : null}
    </main>
  )
}
