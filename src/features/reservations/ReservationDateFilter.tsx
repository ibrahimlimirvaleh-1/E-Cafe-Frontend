import { X } from 'lucide-react'
import { LocalizedDateInput } from '../../shared/ui/LocalizedDateInput'

type ReservationDateFilterProps = {
  value: string
  onChange: (value: string) => void
}

export function ReservationDateFilter({ onChange, value }: ReservationDateFilterProps) {
  return (
    <div className={`reservation-date-filter${value ? ' reservation-date-filter-active' : ''}`}>
      <span className="reservation-date-filter-label">Rezervasiya tarixi</span>
      <label className="reservation-date-filter-control">
        <LocalizedDateInput
          aria-label="Rezervasiya tarixini seçin"
          onChange={(event) => onChange(event.target.value)}
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
