export type DashboardTranslate = (key: string, options?: { count?: number; defaultValue?: string }) => string

export function getDashboardLocale(language?: string) {
  if (language === 'ru') return 'ru-RU'
  if (language === 'en') return 'en-GB'
  return 'az-AZ'
}

export function createDashboardFormatters(locale: string) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'AZN',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
  })

  return {
    number,
    money,
    value(amount: number, unit: string) {
      return ['azn', 'money', 'currency', '₼'].includes(unit.toLowerCase())
        ? money.format(amount)
        : number.format(amount)
    },
  }
}

export type DashboardFormatters = ReturnType<typeof createDashboardFormatters>

export function formatDashboardMoment(date: string, locale: string, timeZone: string, granularity?: 'hour' | 'day') {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date

  const options: Intl.DateTimeFormatOptions = granularity === 'hour'
    ? { hour: '2-digit', minute: '2-digit' }
    : granularity === 'day'
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }

  let safeTimeZone = timeZone
  try {
    new Intl.DateTimeFormat(locale, { timeZone })
  } catch {
    safeTimeZone = 'Asia/Baku'
  }

  const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: safeTimeZone })
  const parts = formatter.formatToParts(parsed)
  const hasPlaceholderMonth = parts.some((part) => part.type === 'month' && /^M\d{1,2}$/i.test(part.value))
  if (locale !== 'az-AZ' || !hasPlaceholderMonth) return formatter.format(parsed)

  const numericParts = new Intl.DateTimeFormat('en-GB', {
    ...options,
    day: '2-digit',
    month: '2-digit',
    year: granularity === 'day' ? undefined : 'numeric',
    timeZone: safeTimeZone,
  }).formatToParts(parsed)
  const value = (type: Intl.DateTimeFormatPartTypes) => numericParts.find((part) => part.type === type)?.value || ''

  return granularity === 'day'
    ? `${value('day')}.${value('month')}`
    : `${value('day')}.${value('month')}.${value('year')}, ${value('hour')}:${value('minute')}`
}
