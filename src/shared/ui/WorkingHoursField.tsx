import type { RestaurantWorkingHour } from '../../entities/types'
import { dayLabels, normalizeWorkingHours } from '../lib/workingHours'
export { createDefaultWorkingHours, formatWorkingHoursSummary } from '../lib/workingHours'

const compactDayLabels = ['Bazar', 'Bazar ert.', 'Çərş. axş.', 'Çərşənbə', 'Cümə axş.', 'Cümə', 'Şənbə']

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0')
  const minutes = index % 2 === 0 ? '00' : '30'
  return `${hours}:${minutes}`
})

export function WorkingHoursList({ workingHours }: { workingHours: RestaurantWorkingHour[] }) {
  return (
    <div className="working-hours-display">
      {normalizeWorkingHours(workingHours).map((hour) => (
        <span key={hour.dayOfWeek}>
          <strong>{dayLabels[hour.dayOfWeek]}</strong>
          <em>{hour.isClosed ? 'Bağlıdır' : `${hour.opensAt} - ${hour.closesAt}`}</em>
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
              <span>{compactDayLabels[hour.dayOfWeek]}</span>
            </label>
            <TimeSelect
              label={`${dayLabels[hour.dayOfWeek]} açılma vaxtı`}
              value={hour.opensAt}
              disabled={hour.isClosed}
              onChange={(opensAt) => updateDay(hour.dayOfWeek, { opensAt })}
            />
            <TimeSelect
              label={`${dayLabels[hour.dayOfWeek]} bağlanma vaxtı`}
              value={hour.closesAt}
              disabled={hour.isClosed}
              onChange={(closesAt) => updateDay(hour.dayOfWeek, { closesAt })}
            />
          </div>
        ))}
      </div>
    </fieldset>
  )
}

function TimeSelect({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  value: string
}) {
  const options = timeOptions.includes(value) ? timeOptions : [value, ...timeOptions]

  return (
    <select
      aria-label={label}
      className="working-hours-time-select"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
