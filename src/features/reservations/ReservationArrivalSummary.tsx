import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import './reservation-arrival.css'

export function ReservationArrivalSummary({ reservation }: { reservation: ReservationResponse }) {
  if (!reservation.expectedArrivalAt && !reservation.arrivalDecisionExpiresAt) return null
  const isWaiting = !reservation.expectedArrivalAt && new Date(reservation.arrivalDecisionExpiresAt || '').getTime() > Date.now()
  if (!reservation.expectedArrivalAt && !isWaiting) return null
  return (
    <section className="reservation-arrival-summary" aria-label="Gecikmə məlumatı">
      <strong>{isWaiting ? 'Gecikmə şərtlərinə razılıq gözlənilir' : 'Gecikmə təsdiqlənib'}</strong>
      <dl>
        {reservation.expectedArrivalAt ? <div><dt>Yeni gəliş vaxtı</dt><dd>{formatReservationDateTime(reservation.expectedArrivalAt, reservation.timeZone || undefined)}</dd></div> : null}
        <div><dt>{isWaiting ? 'Razılıq üçün son vaxt' : 'Gəliş üçün son vaxt'}</dt><dd>{formatReservationDateTime(isWaiting ? reservation.arrivalDecisionExpiresAt : reservation.noShowDeadlineAt, reservation.timeZone || undefined)}</dd></div>
      </dl>
    </section>
  )
}
