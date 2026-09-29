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

export function formatDateOnlyAz(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return value
  }

  return `${day} ${monthNames[month - 1]} ${year}`
}

export function getTodayDateInputValue(timeZone = 'Asia/Baku') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

const bakuDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Baku',
})

export function formatDateInBaku(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const parts = bakuDateFormatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  const month = Number(getPart('month'))
  if (month < 1 || month > 12) return value

  return `${getPart('day')} ${monthNames[month - 1]} ${getPart('year')}`
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
