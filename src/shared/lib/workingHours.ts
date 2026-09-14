import type { RestaurantWorkingHour } from '../../entities/types'

export const dayLabels = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə']

const minutesPerDay = 24 * 60

export function createDefaultWorkingHours(): RestaurantWorkingHour[] {
  return dayLabels.map((_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '09:00',
    closesAt: '00:00',
    closeDayOffset: 1,
    isClosed: false,
  }))
}

export function normalizeWorkingHours(value: RestaurantWorkingHour[] = []) {
  const byDay = new Map(value.map((hour) => [hour.dayOfWeek, hour]))

  return createDefaultWorkingHours().map((fallback) => ({
    ...fallback,
    ...byDay.get(fallback.dayOfWeek),
  }))
}

export function formatWorkingHoursSummary(
  workingHours: RestaurantWorkingHour[] = [],
  timeZone?: string,
  todayWorkingHours?: RestaurantWorkingHour | null,
) {
  const openState = workingHours.length > 0 ? getRestaurantOpenState(workingHours, timeZone) : null
  const todayHours = openState?.isOpen ? openState.todayHours : todayWorkingHours ?? openState?.todayHours

  if (!todayHours) {
    return 'İş saatı qeyd edilməyib'
  }

  if (todayHours.isClosed) {
    return 'Bu gün bağlıdır'
  }

  return `${todayHours.opensAt} - ${todayHours.closesAt}${todayHours.closeDayOffset === 1 ? ' (ertəsi gün)' : ''}`
}

export function getRestaurantOpenState(workingHours: RestaurantWorkingHour[] = [], timeZone?: string, authoritativeIsOpen?: boolean) {
  const now = getTimeZoneNowParts(timeZone)
  const normalized = normalizeWorkingHours(workingHours)
  const todayHours = normalized.find((hour) => hour.dayOfWeek === now.dayOfWeek)
  const yesterdayHours = normalized.find((hour) => hour.dayOfWeek === (now.dayOfWeek + 6) % 7)
  const isOpenToday = isOpenAt(todayHours, now.minutes)
  const isOpenFromYesterday = isOpenFromPreviousDay(yesterdayHours, now.minutes)
  const calculatedIsOpen = isOpenToday || isOpenFromYesterday
  const isOpen = authoritativeIsOpen ?? calculatedIsOpen
  const displayHours = isOpenFromYesterday ? yesterdayHours : todayHours

  return {
    isOpen,
    label: isOpen ? 'Açıqdır' : 'Bağlıdır',
    tone: isOpen ? 'success' : 'neutral',
    todayHours: displayHours,
  } as const
}

function isOpenAt(hour: RestaurantWorkingHour | undefined, minutes: number) {
  if (!hour || hour.isClosed) {
    return false
  }

  const opensAt = parseTimeToMinutes(hour.opensAt)
  const closesAt = parseTimeToMinutes(hour.closesAt)

  if (opensAt == null || closesAt == null) {
    return false
  }

  if (hour.closeDayOffset === 0) {
    if (opensAt === closesAt) {
      return false
    }

    return minutes >= opensAt && minutes < closesAt
  }

  return minutes >= opensAt
}

function isOpenFromPreviousDay(hour: RestaurantWorkingHour | undefined, minutes: number) {
  if (!hour || hour.isClosed) {
    return false
  }

  const opensAt = parseTimeToMinutes(hour.opensAt)
  const closesAt = parseTimeToMinutes(hour.closesAt)

  return opensAt != null && closesAt != null && hour.closeDayOffset === 1 && minutes < closesAt
}

function parseTimeToMinutes(value: string) {
  const [hourText, minuteText] = value.split(':')
  const hours = Number(hourText)
  const minutes = Number(minuteText)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return Math.min((hours * 60) + minutes, minutesPerDay - 1)
}

function getTimeZoneNowParts(timeZone?: string) {
  const now = new Date()

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || undefined,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]))
    const dayOfWeek = weekdayToDayOfWeek(parts.weekday)
    const hour = Number(parts.hour)
    const minute = Number(parts.minute)

    return {
      dayOfWeek,
      minutes: ((Number.isFinite(hour) ? hour : now.getHours()) * 60) + (Number.isFinite(minute) ? minute : now.getMinutes()),
    }
  } catch {
    return {
      dayOfWeek: now.getDay(),
      minutes: (now.getHours() * 60) + now.getMinutes(),
    }
  }
}

function weekdayToDayOfWeek(value: string | undefined) {
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return value ? weekdays[value] ?? new Date().getDay() : new Date().getDay()
}
