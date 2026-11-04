import { ArrowRight, CalendarDays, CalendarCheck2, Clock3, Table2, Users, Wallet } from 'lucide-react'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { i18n } from '../../shared/i18n/i18n'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation, isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'

export function CustomerReservationListItem({ reservation }: { reservation: ReservationResponse }) {
  const presentation = getReservationStatusPresentation(reservation.status)
  const arrival = reservation.expectedArrivalAt || reservation.reservedAt
  const changedArrival = Boolean(reservation.expectedArrivalAt && Date.parse(reservation.expectedArrivalAt) !== Date.parse(reservation.reservedAt))
  const formatTime = (value: string) => formatReservationDateTime(value, reservation.timeZone || undefined)
  const paymentDeadline = isReservationAwaitingPayment(reservation.status) ? reservation.holdExpiresAt : null
  const responseDeadline = presentation.tone === 'warning' ? reservation.restaurantResponseExpiresAt : null
  const deadline = paymentDeadline || responseDeadline

  return <article className="customer-reservation-card" aria-labelledby={`reservation-title-${reservation.id}`}>
    <header className="customer-reservation-card-header">
      <div className="my-reservation-identity">
        <span className="my-reservation-symbol" aria-hidden="true"><CalendarCheck2 size={23} strokeWidth={1.5} /></span>
        <div>
          <span className="reservation-card-kicker">{i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_0a8e06')}{reservation.id}</span>
          <h2 id={`reservation-title-${reservation.id}`}>{reservation.restaurantName || i18n.t('ui.myReservations.restaurantFallback')}</h2>
        </div>
      </div>
      <Badge tone={presentation.tone}>{presentation.label}</Badge>
    </header>
    <dl className="customer-reservation-meta">
      <div className="reservation-meta-item">
        <dt><CalendarDays size={15} aria-hidden="true" />{i18n.t(changedArrival ? 'ui.pages.customer.my_reservations_page.yeni_gelis_fda112' : 'ui.pages.customer.my_reservations_page.gelis_vaxti_449387')}</dt>
        <dd><time dateTime={arrival}>{formatTime(arrival)}</time>{changedArrival ? <small>{i18n.t('ui.myReservations.originalArrival', { time: formatTime(reservation.reservedAt) })}</small> : null}</dd>
      </div>
      <div className="reservation-meta-item"><dt><Table2 size={15} aria-hidden="true" />{i18n.t('ui.pages.customer.my_reservations_page.masa_058c4c')}</dt><dd>{reservation.tableName || i18n.t('ui.myReservations.tableNumber', { number: reservation.tableId })}</dd></div>
      <div className="reservation-meta-item"><dt><Users size={15} aria-hidden="true" />{i18n.t('ui.pages.customer.my_reservations_page.qonaq_sayi_012aa3')}</dt><dd>{i18n.t('ui.count.guests', { count: reservation.peopleCount })}</dd></div>
      <div className="reservation-meta-item"><dt><Wallet size={15} aria-hidden="true" />{i18n.t('ui.pages.customer.my_reservations_page.depozit_4a14b8')}</dt><dd>{reservation.depositAmount > 0 ? `${reservation.depositAmount.toFixed(2)} AZN` : i18n.t('ui.pages.customer.my_reservations_page.teleb_olunmur_46f021')}</dd></div>
    </dl>
    <ButtonLink className="my-reservation-details" variant="secondary" to={`/confirmation?reservationId=${reservation.id}`} aria-label={i18n.t('ui.myReservations.detailsFor', { id: reservation.id })}>
      {i18n.t('ui.pages.customer.my_reservations_page.detallara_bax_38343d')}<ArrowRight size={16} aria-hidden="true" />
    </ButtonLink>
    {deadline ? <p className="my-reservation-deadline"><Clock3 size={15} aria-hidden="true" />{i18n.t(paymentDeadline ? 'ui.myReservations.paymentDeadline' : 'ui.myReservations.responseDeadline', { time: formatTime(deadline) })}</p> : null}
  </article>
}
