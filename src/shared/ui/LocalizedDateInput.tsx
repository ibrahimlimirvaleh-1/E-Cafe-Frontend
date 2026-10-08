import { CalendarDays } from 'lucide-react'
import type { InputHTMLAttributes, MouseEvent } from 'react'
import { formatDateOnlyAz } from '../lib/dateFormatting'

type LocalizedDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  value?: string
}

export function LocalizedDateInput({ className, onClick, value = '', ...props }: LocalizedDateInputProps) {
  const openPicker = (event: MouseEvent<HTMLInputElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented && !event.currentTarget.disabled) {
      try {
        event.currentTarget.showPicker()
      } catch {
        // The native input remains usable when the browser does not support showPicker.
      }
    }
  }

  return (
    <span className={`localized-date-input${className ? ` ${className}` : ''}`}>
      <CalendarDays aria-hidden="true" size={18} />
      <span className={`localized-date-input-value${value ? '' : ' localized-date-input-placeholder'}`} aria-hidden="true">
        {value ? formatDateOnlyAz(value) : 'Tarix seçin'}
      </span>
      <input {...props} className="localized-date-input-native" lang="az" onClick={openPicker} type="date" value={value} />
    </span>
  )
}
