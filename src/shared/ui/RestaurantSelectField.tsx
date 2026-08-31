import { ChevronDown } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import type { Restaurant } from '../../entities/types'
import { restaurantOptionLabel } from './RestaurantContextCard'

type RestaurantSelectFieldProps = {
  disabled?: boolean
  error?: string
  label?: string
  onChange: (restaurantId: string) => void
  placeholder?: string
  required?: boolean
  restaurants: Restaurant[]
  value: string
}

export function RestaurantSelectField({
  disabled = false,
  error,
  label = 'Restoran',
  onChange,
  placeholder = 'Restoran seçin...',
  required = false,
  restaurants,
  value,
}: RestaurantSelectFieldProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === value)
  const selectedLabel = selectedRestaurant ? restaurantOptionLabel(selectedRestaurant) : ''

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  const selectRestaurant = (restaurantId: string) => {
    onChange(restaurantId)
    setIsOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen((current) => !current)
    }
  }

  return (
    <div className={`ui-field restaurant-select-field${error ? ' ui-field-invalid' : ''}`} ref={rootRef}>
      <span>{label}</span>
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-invalid={Boolean(error)}
        aria-required={required}
        className="restaurant-select-trigger"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        title={selectedLabel || placeholder}
        type="button"
      >
        <span>{selectedLabel || placeholder}</span>
        <ChevronDown size={18} />
      </button>
      {isOpen ? (
        <div className="restaurant-select-options" id={listboxId} role="listbox">
          <button
            className={!value ? 'selected' : undefined}
            onClick={() => selectRestaurant('')}
            role="option"
            title={placeholder}
            type="button"
          >
            {placeholder}
          </button>
          {restaurants.map((restaurant) => {
            const optionLabel = restaurantOptionLabel(restaurant)
            return (
              <button
                aria-selected={restaurant.id === value}
                className={restaurant.id === value ? 'selected' : undefined}
                key={restaurant.id}
                onClick={() => selectRestaurant(restaurant.id)}
                role="option"
                title={optionLabel}
                type="button"
              >
                {optionLabel}
              </button>
            )
          })}
        </div>
      ) : null}
      {error ? <small className="ui-field-error">{error}</small> : null}
    </div>
  )
}
