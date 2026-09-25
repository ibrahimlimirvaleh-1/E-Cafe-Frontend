import { X } from 'lucide-react'
import { TextField } from '../../shared/ui/FormField'

type ReservationDateFilterProps = {
  value: string
  onChange: (value: string) => void
}

export function ReservationDateFilter({ onChange, value }: ReservationDateFilterProps) {
  return (
    <div className="reservation-date-filter">
      <TextField
        label="Rezervasiya tarixi"
        onChange={(event) => onChange(event.target.value)}
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
