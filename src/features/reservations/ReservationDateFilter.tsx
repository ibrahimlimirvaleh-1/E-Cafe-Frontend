import { CalendarDays, X } from 'lucide-react'
import { useRef } from 'react'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedDateLabel = formatSelectedDate(value)

  function openDatePicker() {
    const input = inputRef.current
    if (!input) {
      return
    }

    try {
      input.showPicker()
    } catch {
      input.focus()
      input.click()
    }
  }

  return (
    <div className={`reservation-date-filter${value ? ' reservation-date-filter-active' : ''}`}>
      <span className="reservation-date-filter-label">Rezervasiya tarixi</span>
      <button
        aria-label={`Rezervasiya tarixi: ${selectedDateLabel}`}
        className="reservation-date-filter-control"
        onClick={openDatePicker}
        type="button"
      >
        <CalendarDays aria-hidden="true" size={18} />
        <span>{selectedDateLabel}</span>
      </button>
      <input
        aria-label="Rezervasiya tarixini seçin"
        className="reservation-date-filter-input"
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        type="date"
        value={value}
      />
      {value ? (
        <button aria-label="Tarix filterini təmizlə" className="reservation-date-filter-clear" onClick={() => onChange('')} title="Tarix filterini təmizlə" type="button">
          <X size={18} />
        </button>
      ) : null}
    </div>
  )
}
