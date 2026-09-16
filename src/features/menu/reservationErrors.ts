import { ApiError } from '../../shared/api/httpClient'

export function getReservationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 409 || error.code === 'TableAlreadyReserved') {
      return 'Bu masa artıq doludur. Başqa masa seçin.'
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Rezervasiya yaradıla bilmədi. Bir az sonra yenidən yoxlayın.'
}
