import { CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ButtonLink } from '../../shared/ui/Button'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { ReservationPaymentProofPanel } from '../../features/reservations/ReservationPaymentProofPanel'

export function ConfirmationPage() {
  const [searchParams] = useSearchParams()
  const reservationId = searchParams.get('reservationId')
  const { data: reservation, error, isLoading } = useAsyncData(
    () => reservationId ? ecafeApi.reservations.getById(reservationId) : Promise.resolve(null),
    null,
    [reservationId],
  )

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
              <div><dt>Status</dt><dd>{reservation.status}</dd></div>
              <div><dt>Depozit</dt><dd>{reservation.depositAmount.toFixed(2)} AZN</dd></div>
              {reservation.holdExpiresAt ? <div><dt>Ödəniş üçün son vaxt</dt><dd>{formatReservationDateTime(reservation.holdExpiresAt)}</dd></div> : null}
            </dl>

            {reservation.latestPaymentInstruction && reservation.status.toLowerCase().includes('pending') ? (
              <ReservationPaymentProofPanel
                restaurantId={String(reservation.restaurantId)}
                reservationId={String(reservation.id)}
                amount={reservation.latestPaymentInstruction.amount || reservation.depositAmount}
              />
            ) : null}
          </>
        ) : null}
        <ButtonLink to="/tracking/demo-token">Rezervasiyanı izlə</ButtonLink>
      </article>
    </main>
  )
}
