import { CalendarDays, X } from 'lucide-react'

type ReservationDateFilterProps = {
  value: string
  onChange: (value: string) => void
}

const dateFormatter = new Intl.DateTimeFormat('az-AZ', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatSelectedDate(value: string) {
  if (!value) {
    return 'Bütün tarixlər'
  }

  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

export function ReservationDateFilter({ onChange, value }: ReservationDateFilterProps) {
  return (
    <div className={`reservation-date-filter${value ? ' reservation-date-filter-active' : ''}`}>
      <span className="reservation-date-filter-label">Rezervasiya tarixi</span>
      <label className="reservation-date-filter-control">
        <CalendarDays aria-hidden="true" size={18} />
        <span>{formatSelectedDate(value)}</span>
        <input
          aria-label="Rezervasiya tarixini seçin"
          className="reservation-date-filter-input"
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={value}
        />
      </label>
      {value ? (
        <button aria-label="Tarix filterini təmizlə" className="reservation-date-filter-clear" onClick={() => onChange('')} title="Tarix filterini təmizlə" type="button">
          <X size={18} />
        </button>
      ) : null}
    </div>
  )
}
