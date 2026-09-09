import type { RestaurantWorkingHour } from '../../entities/types'
import { dayLabels, normalizeWorkingHours } from '../lib/workingHours'
export { createDefaultWorkingHours, formatWorkingHoursSummary } from '../lib/workingHours'

export function WorkingHoursList({ workingHours }: { workingHours: RestaurantWorkingHour[] }) {
  return (
    <div className="working-hours-display">
      {normalizeWorkingHours(workingHours).map((hour) => (
        <span key={hour.dayOfWeek}>
          <strong>{dayLabels[hour.dayOfWeek]}</strong>
          {hour.isClosed ? 'Bağlıdır' : `${hour.opensAt} - ${hour.closesAt}`}
        </span>
      ))}
    </div>
  )
}

type WorkingHoursFieldProps = {
  value: RestaurantWorkingHour[]
  onChange: (value: RestaurantWorkingHour[]) => void
}

export function WorkingHoursField({ onChange, value }: WorkingHoursFieldProps) {
  const normalizedValue = normalizeWorkingHours(value)

  function updateDay(dayOfWeek: number, patch: Partial<RestaurantWorkingHour>) {
    onChange(normalizedValue.map((hour) => (hour.dayOfWeek === dayOfWeek ? { ...hour, ...patch } : hour)))
  }

  return (
    <fieldset className="working-hours-field">
      <legend>İş saatları</legend>
      <div className="working-hours-list">
        {normalizedValue.map((hour) => (
          <div className="working-hours-row" key={hour.dayOfWeek}>
            <label className="working-day-toggle">
              <input
                checked={!hour.isClosed}
                onChange={(event) => updateDay(hour.dayOfWeek, { isClosed: !event.target.checked })}
                type="checkbox"
              />
              <span>{dayLabels[hour.dayOfWeek]}</span>
            </label>
            <input
              aria-label={`${dayLabels[hour.dayOfWeek]} açılma vaxtı`}
              disabled={hour.isClosed}
              onChange={(event) => updateDay(hour.dayOfWeek, { opensAt: event.target.value })}
              type="time"
              value={hour.opensAt}
            />
            <input
              aria-label={`${dayLabels[hour.dayOfWeek]} bağlanma vaxtı`}
              disabled={hour.isClosed}
              onChange={(event) => updateDay(hour.dayOfWeek, { closesAt: event.target.value })}
              type="time"
              value={hour.closesAt}
            />
          </div>
        ))}
      </div>
    </fieldset>
  )
}
