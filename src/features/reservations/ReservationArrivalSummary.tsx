import { i18n } from '../../shared/i18n/i18n'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import './reservation-arrival.css'

export function ReservationArrivalSummary({ reservation }: { reservation: ReservationResponse }) {
  if (!reservation.expectedArrivalAt && !reservation.arrivalDecisionExpiresAt) return null
  const isWaiting = !reservation.expectedArrivalAt && new Date(reservation.arrivalDecisionExpiresAt || '').getTime() > Date.now()
  if (!reservation.expectedArrivalAt && !isWaiting) return null
  return (
    <section className="reservation-arrival-summary" aria-label={i18n.t('ui.features.reservations.reservation_arrival_summary.gecikme_melumati_bb9248')}>
      <strong>{isWaiting ?i18n.t('ui.features.reservations.reservation_arrival_summary.gecikme_sertlerine_raziliq_gozlenilir_420174') :i18n.t('ui.features.reservations.reservation_arrival_summary.gecikme_tesdiqlenib_6ffab3')}</strong>
      <dl>
        {reservation.expectedArrivalAt ? <div><dt>{i18n.t('ui.features.reservations.reservation_arrival_summary.yeni_gelis_vaxti_397ff9')}</dt><dd>{formatReservationDateTime(reservation.expectedArrivalAt, reservation.timeZone || undefined)}</dd></div> : null}
        <div><dt>{isWaiting ?i18n.t('ui.features.reservations.reservation_arrival_summary.raziliq_ucun_son_vaxt_25b432') :i18n.t('ui.features.reservations.reservation_arrival_summary.gelis_ucun_son_vaxt_04c872')}</dt><dd>{formatReservationDateTime(isWaiting ? reservation.arrivalDecisionExpiresAt : reservation.noShowDeadlineAt, reservation.timeZone || undefined)}</dd></div>
      </dl>
    </section>
  )
}
