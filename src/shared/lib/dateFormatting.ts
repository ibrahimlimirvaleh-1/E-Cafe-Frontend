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

// AZ tarix formatında cihaz ayı "M10" kimi qaytararsa, oxunaqlı rəqəmli formata keçirik.
function formatLocalizedDate(date: Date, options: Intl.DateTimeFormatOptions, includeTime = false) {
  const formatter = new Intl.DateTimeFormat(currentLocale(), options)
  const parts = formatter.formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value || ''
  if (getCurrentLanguage() !== 'az' || !/^M\d{1,2}$/i.test(month)) return formatter.format(date)

  const numericParts = new Intl.DateTimeFormat('en-GB', {
    ...options,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => numericParts.find((part) => part.type === type)?.value || ''
  const numericDate = `${value('day')}.${value('month')}.${value('year')}`
  return includeTime ? `${numericDate}, ${value('hour')}:${value('minute')}` : numericDate
}

// YYYY-MM-DD tarixini aktiv dildə göstərir; AZ ICU ay adı olmadıqda rəqəmli forma işlədilir.
export function formatDateOnlyAz(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return value
  }

  return formatLocalizedDate(new Date(Date.UTC(year, month - 1, day)), {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
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

// Anı Bakı saat qurşağında tarix kimi göstərir, səhv dəyərləri olduğu kimi saxlayır.
export function formatDateInBaku(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return formatLocalizedDate(date, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baku',
  })
}

// Rezervasiya anını seçilən saat qurşağında tarix və saat olaraq göstərir.
export function formatReservationDateTime(value?: string | null, timeZone?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return formatLocalizedDate(date, {
    ...reservationDateTimeOptions, month: 'long', timeZone,
  }, true)
}
