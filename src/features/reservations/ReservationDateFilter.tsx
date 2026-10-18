import { i18n } from '../../shared/i18n/i18n'
import { X } from 'lucide-react'
import { LocalizedDateInput } from '../../shared/ui/LocalizedDateInput'

type ReservationDateFilterProps = {
  value: string
  onChange: (value: string) => void
}

export function ReservationDateFilter({ onChange, value }: ReservationDateFilterProps) {
  return (
    <div className={`reservation-date-filter${value ? ' reservation-date-filter-active' : ''}`}>
      <span className="reservation-date-filter-label">{i18n.t('ui.features.reservations.reservation_date_filter.rezervasiya_tarixi_35eb44')}</span>
      <label className="reservation-date-filter-control">
        <LocalizedDateInput
          aria-label={i18n.t('ui.features.reservations.reservation_date_filter.rezervasiya_tarixini_secin_5ff769')}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </label>
      {value ? (
        <button aria-label={i18n.t('ui.features.reservations.reservation_date_filter.tarix_filterini_temizle_a2cc94')} className="reservation-date-filter-clear" onClick={() => onChange('')} title={i18n.t('ui.features.reservations.reservation_date_filter.tarix_filterini_temizle_a2cc94')} type="button">
          <X size={18} />
        </button>
      ) : null}
    </div>
  )
}
