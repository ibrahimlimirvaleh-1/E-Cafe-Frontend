import type { RestaurantWorkingHour } from '../../entities/types'
import { i18n } from '../i18n/i18n'

export const dayLabels = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə']

const minutesPerDay = 24 * 60

export function createDefaultWorkingHours(): RestaurantWorkingHour[] {
  return dayLabels.map((_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: '09:00',
    closesAt: '00:00',
    closeDayOffset: 1,
    lastReservationArrivalAt: null,
    lastReservationArrivalDayOffset: null,
    isClosed: false,
  }))
}

export function workingHoursRequest(value: RestaurantWorkingHour[]) {
  return value.map((hour) => ({
    ...hour,
    lastReservationArrivalAt: !hour.isClosed && hour.lastReservationArrivalAt ? `${hour.lastReservationArrivalAt.slice(0, 5)}:00` : null,
    lastReservationArrivalDayOffset: !hour.isClosed && hour.lastReservationArrivalAt ? hour.lastReservationArrivalDayOffset ?? 0 : null,
  }))
}

export function isArrivalCutoffWithinHours(hour: RestaurantWorkingHour) {
  if (hour.lastReservationArrivalAt == null) return true
  const opensAt = parseTimeToMinutes(hour.opensAt)
  const closesAt = parseTimeToMinutes(hour.closesAt)
  const cutoffAt = parseTimeToMinutes(hour.lastReservationArrivalAt)
  const offset = hour.lastReservationArrivalDayOffset
  return opensAt != null && closesAt != null && cutoffAt != null && (offset === 0 || offset === 1) &&
    cutoffAt + offset * minutesPerDay >= opensAt &&
    cutoffAt + offset * minutesPerDay < closesAt + hour.closeDayOffset * minutesPerDay
}

export function isWorkingHourRangeValid(hour: RestaurantWorkingHour) {
  const opensAt = parseTimeToMinutes(hour.opensAt)
  const closesAt = parseTimeToMinutes(hour.closesAt)
  return opensAt != null && closesAt != null && (hour.closeDayOffset === 0 || hour.closeDayOffset === 1) &&
    closesAt + hour.closeDayOffset * minutesPerDay > opensAt
}

export function getReservationDayHours(workingHours: RestaurantWorkingHour[], date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  const normalized = normalizeWorkingHours(workingHours)
  const previous = normalized.find((hour) => hour.dayOfWeek === (day + 6) % 7)
  const current = normalized.find((hour) => hour.dayOfWeek === day)
  const selected = parseTimeToMinutes(time)
  if (selected == null) return current ?? null
  const intervals = [
    previous?.closeDayOffset === 1 && !previous.isClosed ? {
      hour: previous, startsAt: (parseTimeToMinutes(previous.opensAt) ?? 0) - minutesPerDay,
      endsAt: parseTimeToMinutes(previous.closesAt) ?? 0,
    } : null,
    current && !current.isClosed ? {
      hour: current, startsAt: parseTimeToMinutes(current.opensAt) ?? 0,
      endsAt: (parseTimeToMinutes(current.closesAt) ?? 0) + current.closeDayOffset * minutesPerDay,
    } : null,
  ].filter((interval): interval is { hour: RestaurantWorkingHour; startsAt: number; endsAt: number } =>
    interval != null && selected >= interval.startsAt && selected < interval.endsAt)
  intervals.sort((first, second) => second.endsAt - first.endsAt || second.startsAt - first.startsAt)
  return intervals[0]?.hour ?? current ?? null
}

export function normalizeWorkingHours(value: RestaurantWorkingHour[] = []) {
  const byDay = new Map(value.map((hour) => [hour.dayOfWeek, hour]))

  return createDefaultWorkingHours().map((fallback) => {
    const hour = { ...fallback, ...byDay.get(fallback.dayOfWeek) }
    const opensAt = parseTimeToMinutes(hour.opensAt)
    const closesAt = parseTimeToMinutes(hour.closesAt)

    return {
      ...hour,
      closeDayOffset:
        !hour.isClosed && opensAt != null && closesAt === 0 && opensAt > closesAt
          ? 1
          : hour.closeDayOffset,
    }
  })
}

export function formatWorkingHoursSummary(
  workingHours: RestaurantWorkingHour[] = [],
  timeZone?: string,
  todayWorkingHours?: RestaurantWorkingHour | null,
) {
  const openState = workingHours.length > 0 ? getRestaurantOpenState(workingHours, timeZone) : null
  const todayHours = openState?.isOpen ? openState.todayHours : todayWorkingHours ?? openState?.todayHours

  if (!todayHours) {
    return i18n.t('ui.workingHours.notSet')
  }

  if (todayHours.isClosed) {
    return i18n.t('ui.workingHours.closedToday')
  }

  return `${todayHours.opensAt} - ${todayHours.closesAt}`
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
    label: i18n.t(isOpen ? 'ui.workingHours.open' : 'ui.workingHours.closed'),
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
