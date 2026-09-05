import type { ReactNode } from 'react'

const operatorCodes = ['50', '51', '55', '70', '77', '99', '10', '60']

type PhoneFieldProps = {
  error?: ReactNode
  hint?: ReactNode
  label: string
  required?: boolean
  value: string
  onChange: (value: string) => void
}

function parseAzerbaijanPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  const localDigits = digits.startsWith('994') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits
  const operator = operatorCodes.includes(localDigits.slice(0, 2)) ? localDigits.slice(0, 2) : operatorCodes[0]
  const number = operatorCodes.includes(localDigits.slice(0, 2)) ? localDigits.slice(2, 9) : localDigits.slice(0, 7)

  return {
    operator,
    number,
  }
}

function buildPhoneValue(operator: string, number: string) {
  const cleanedNumber = number.replace(/\D/g, '').slice(0, 7)
  return cleanedNumber ? `+994${operator}${cleanedNumber}` : ''
}

export function PhoneField({ error, hint, label, onChange, required, value }: PhoneFieldProps) {
  const parsed = parseAzerbaijanPhone(value)

  return (
    <label className={`ui-field phone-field${error ? ' ui-field-invalid' : ''}`}>
      <span>{label}</span>
      <div className="phone-field-control">
        <span className="phone-country-code">+994</span>
        <select
          aria-label={`${label} operator kodu`}
          value={parsed.operator}
          onChange={(event) => onChange(buildPhoneValue(event.target.value, parsed.number))}
        >
          {operatorCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <input
          aria-invalid={Boolean(error)}
          inputMode="numeric"
          maxLength={7}
          pattern="[0-9]{7}"
          placeholder="1234567"
          required={required}
          value={parsed.number}
          onChange={(event) => onChange(buildPhoneValue(parsed.operator, event.target.value))}
        />
      </div>
      {error ? <small className="ui-field-error">{error}</small> : null}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}
