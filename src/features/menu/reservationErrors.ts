import { ApiError } from '../../shared/api/httpClient'

const CUSTOMER_DAILY_RESERVATION_CODE = 'CustomerAlreadyHasReservationToday'
const TABLE_ALREADY_RESERVED_CODE = 'TableAlreadyReserved'

export function getReservationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === CUSTOMER_DAILY_RESERVATION_CODE) {
      return 'Bu gün bu restoran üçün artıq aktiv rezervasiyanız var. Başqa tarix seçin.'
    }

    if (error.code === TABLE_ALREADY_RESERVED_CODE) {
      return 'Bu masa artıq doludur. Başqa masa seçin.'
    }

    if (error.statusCode === 409) {
      return 'Rezervasiya bu vaxt üçün yaradıla bilmədi. Başqa masa və ya vaxt seçin.'
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Rezervasiya yaradıla bilmədi. Bir az sonra yenidən yoxlayın.'
}

export function isTableReservationConflict(error: unknown) {
  return error instanceof ApiError && error.code === TABLE_ALREADY_RESERVED_CODE
}

export function isCustomerDailyReservationLimit(error: unknown) {
  return error instanceof ApiError && error.code === CUSTOMER_DAILY_RESERVATION_CODE
}
