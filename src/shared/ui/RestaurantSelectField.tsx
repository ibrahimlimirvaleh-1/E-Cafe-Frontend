import { ChevronDown, Store } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Restaurant } from '../../entities/types'
import { useAuth } from '../auth/AuthContext'
import { canAccessRestaurant } from '../auth/authz'
import { restaurantOptionLabel } from './RestaurantContextCard'

type RestaurantSelectFieldProps = {
  disabled?: boolean
  emptyOption?: { label: string; value: string } | null
  error?: string
  label?: string
  onChange: (restaurantId: string) => void
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  required?: boolean
  restaurants?: Restaurant[]
  value: string
}

export function RestaurantSelectField({
  disabled = false,
  emptyOption,
  error,
  label = 'Restoran',
  onChange,
  options,
  placeholder = 'Restoran seçin...',
  required = false,
  restaurants = [],
  value,
}: RestaurantSelectFieldProps) {
  const { user } = useAuth()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const restaurantOptions = useMemo(
    () =>
      options ??
      restaurants
        .filter((restaurant) => canAccessRestaurant(user, restaurant.id))
        .map((restaurant) => ({
          label: restaurantOptionLabel(restaurant),
          value: restaurant.id,
        })),
    [options, restaurants, user],
  )
  const fallbackOption = emptyOption === undefined ? { label: placeholder, value: '' } : emptyOption
  const selectedOption = restaurantOptions.find((option) => option.value === value)
  const selectedLabel = selectedOption?.label ?? (fallbackOption?.value === value ? fallbackOption.label : '')
  const shouldRenderReadOnly = !disabled && !fallbackOption && restaurantOptions.length === 1

  useEffect(() => {
    if (!value || disabled) {
      return
    }

    const hasSelectedRestaurant = restaurantOptions.some((option) => option.value === value)
    const hasFallbackValue = fallbackOption?.value === value

    if (!hasSelectedRestaurant && !hasFallbackValue) {
      onChange(fallbackOption?.value ?? '')
    }
  }, [disabled, fallbackOption?.value, onChange, restaurantOptions, value])

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
      {shouldRenderReadOnly ? (
        <div className="restaurant-select-readonly" title={selectedLabel || placeholder}>
          <Store size={18} />
          <span>{selectedLabel || placeholder}</span>
        </div>
      ) : (
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
      )}
      {isOpen ? (
        <div className="restaurant-select-options" id={listboxId} role="listbox">
          {fallbackOption ? (
            <button
              aria-selected={fallbackOption.value === value}
              className={fallbackOption.value === value ? 'selected' : undefined}
              onClick={() => selectRestaurant(fallbackOption.value)}
              role="option"
              title={fallbackOption.label}
              type="button"
            >
              {fallbackOption.label}
            </button>
          ) : null}
          {restaurantOptions.map((option) => {
            return (
              <button
                aria-selected={option.value === value}
                className={option.value === value ? 'selected' : undefined}
                key={option.value}
                onClick={() => selectRestaurant(option.value)}
                role="option"
                title={option.label}
                type="button"
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
      {error ? <small className="ui-field-error">{error}</small> : null}
    </div>
  )
}
