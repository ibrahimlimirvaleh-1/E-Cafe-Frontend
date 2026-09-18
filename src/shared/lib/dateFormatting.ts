const reservationDateTimeFormatter = new Intl.DateTimeFormat('az-AZ', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatReservationDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return reservationDateTimeFormatter.format(date).replace(' at ', ', ')
}
