import type { RestaurantWorkingHour } from '../../entities/types'

export const dayLabels = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə']

const minutesPerDay = 24 * 60

export function createDefaultWorkingHours(): RestaurantWorkingHour[] {
  return dayLabels.map((_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '09:00',
    closesAt: '00:00',
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

export function formatWorkingHoursSummary(workingHours: RestaurantWorkingHour[] = [], timeZone?: string) {
  const state = getRestaurantOpenState(workingHours, timeZone)

  if (!state.todayHours) {
    return 'İş saatı qeyd edilməyib'
  }

  if (state.todayHours.isClosed) {
    return 'Bu gün bağlıdır'
  }

  return `${state.todayHours.opensAt} - ${state.todayHours.closesAt}`
}

export function getRestaurantOpenState(workingHours: RestaurantWorkingHour[] = [], timeZone?: string, authoritativeIsOpen?: boolean) {
  if (authoritativeIsOpen != null) {
    return {
      isOpen: authoritativeIsOpen,
      label: authoritativeIsOpen ? 'Açıqdır' : 'Bağlıdır',
      tone: authoritativeIsOpen ? 'success' : 'neutral',
      todayHours: getTodayHours(workingHours, timeZone),
    } as const
  }

  const now = getTimeZoneNowParts(timeZone)
  const normalized = normalizeWorkingHours(workingHours)
  const todayHours = normalized.find((hour) => hour.dayOfWeek === now.dayOfWeek)
  const yesterdayHours = normalized.find((hour) => hour.dayOfWeek === (now.dayOfWeek + 6) % 7)

  const isOpen = isOpenAt(todayHours, now.minutes) || isOpenFromPreviousDay(yesterdayHours, now.minutes)

  return {
    isOpen,
    label: isOpen ? 'Açıqdır' : 'Bağlıdır',
    tone: isOpen ? 'success' : 'neutral',
    todayHours,
  } as const
}

function getTodayHours(workingHours: RestaurantWorkingHour[] = [], timeZone?: string) {
  const now = getTimeZoneNowParts(timeZone)
  return normalizeWorkingHours(workingHours).find((hour) => hour.dayOfWeek === now.dayOfWeek)
}

function isOpenAt(hour: RestaurantWorkingHour | undefined, minutes: number) {
  if (!hour || hour.isClosed) {
    return false
  }

  const opensAt = parseTimeToMinutes(hour.opensAt)
  const closesAt = parseTimeToMinutes(hour.closesAt)

  if (opensAt == null || closesAt == null || opensAt === closesAt) {
    return false
  }

  if (opensAt < closesAt) {
    return minutes >= opensAt && minutes < closesAt
  }

  return minutes >= opensAt || minutes < closesAt
}

function isOpenFromPreviousDay(hour: RestaurantWorkingHour | undefined, minutes: number) {
  if (!hour || hour.isClosed) {
    return false
  }

  const opensAt = parseTimeToMinutes(hour.opensAt)
  const closesAt = parseTimeToMinutes(hour.closesAt)

  return opensAt != null && closesAt != null && opensAt > closesAt && minutes < closesAt
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
