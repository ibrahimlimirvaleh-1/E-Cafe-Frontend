const reservationDateTimeOptions: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}
const reservationDateTimeFormatter = new Intl.DateTimeFormat('az-AZ', reservationDateTimeOptions)

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

function zonedDayStartUtc(value: string, timeZone: string) {
  const target = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(target.getTime()) || target.toISOString().slice(0, 10) !== value) return null

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  let timestamp = target.getTime()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(timestamp))
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value)
    const displayedAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
    const difference = target.getTime() - displayedAsUtc
    timestamp += difference
    if (difference === 0) break
  }
  return timestamp
}

export function toUtcZonedDayBoundary(value: string, boundary: 'start' | 'end', timeZone = 'Asia/Baku') {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return value
  if (boundary === 'end') date.setUTCDate(date.getUTCDate() + 1)
  const start = zonedDayStartUtc(date.toISOString().slice(0, 10), timeZone)
  return start == null ? value : new Date(start - (boundary === 'end' ? 1 : 0)).toISOString()
}

export function toZonedDayStartOffset(value: string, timeZone = 'Asia/Baku') {
  const start = zonedDayStartUtc(value, timeZone)
  if (start == null) return value
  const offsetMinutes = (Date.parse(`${value}T00:00:00.000Z`) - start) / 60_000
  const sign = offsetMinutes < 0 ? '-' : '+'
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0')
  return `${value}T00:00:00${sign}${hours}:${minutes}`
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

export function formatReservationDateTime(value?: string | null, timeZone?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const formatter = timeZone
    ? new Intl.DateTimeFormat('az-AZ', { ...reservationDateTimeOptions, timeZone })
    : reservationDateTimeFormatter
  const parts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  const month = Number(getPart('month'))

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return value
  }

  return `${getPart('day')} ${monthNames[month - 1]} ${getPart('year')}, ${getPart('hour')}:${getPart('minute')}`
}
