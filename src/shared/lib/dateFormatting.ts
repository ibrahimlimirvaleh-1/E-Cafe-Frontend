const reservationDateTimeFormatter = new Intl.DateTimeFormat('az-AZ', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const monthNames = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
]

export function formatReservationDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return value
  }

  const [, year, monthValue, day] = match
  const month = Number(monthValue)
  if (month < 1 || month > 12) {
    return value
  }

  return `${Number(day)} ${monthNames[month - 1]} ${year}`
}

export function formatReservationDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const parts = reservationDateTimeFormatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  const month = Number(getPart('month'))

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return value
  }

  return `${getPart('day')} ${monthNames[month - 1]} ${getPart('year')}, ${getPart('hour')}:${getPart('minute')}`
}
