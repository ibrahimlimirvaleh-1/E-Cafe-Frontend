import type { TableAvailabilityResponse } from '../../shared/api/ecafeApi'
import { i18n } from '../../shared/i18n/i18n'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'

export function isAvailabilityBookable(availability: TableAvailabilityResponse) {
  return availability.isRestaurantOpen && availability.hasAvailableTable && availability.isReservationArrivalAllowed !== false
}

export function getAvailabilityMessage(availability: TableAvailabilityResponse, timeZone?: string) {
  if (availability.messageCode === 'ReservationArrivalCutoffPassed' ||
      (availability.isReservationArrivalAllowed === false && availability.isRestaurantOpen)) {
    return availability.reservationArrivalCutoffAt
      ? i18n.t('ui.arrival.cutoffPassedWithTime', {
        time: formatReservationDateTime(availability.reservationArrivalCutoffAt, availability.restaurantTimeZone || timeZone),
      })
      : i18n.t('ui.arrival.cutoffPassed')
  }
  if (!availability.isRestaurantOpen) {
    return availability.message || 'Seçdiyiniz tarix və saatda restoran bağlıdır. Başqa vaxt seçin.'
  }
  return availability.message || 'Bu saat üçün boş masa yoxdur. Başqa tarix və ya saat seçin.'
}
