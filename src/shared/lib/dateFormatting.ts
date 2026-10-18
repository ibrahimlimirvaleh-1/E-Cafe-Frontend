import { getCurrentLanguage } from '../i18n/i18n'
import { getIntlLocale } from '../i18n/language'

const reservationDateTimeOptions: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}

function currentLocale() {
  return getIntlLocale(getCurrentLanguage())
}

export function formatDateOnlyAz(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return value
  }

  return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
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

export function formatDateInBaku(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(currentLocale(), {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baku',
  }).format(date)
}

export function formatReservationDateTime(value?: string | null, timeZone?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(currentLocale(), {
    ...reservationDateTimeOptions, month: 'long', timeZone,
  }).format(date)
}
