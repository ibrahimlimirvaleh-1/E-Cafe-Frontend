import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type FieldShellProps = {
  error?: ReactNode
  label: string
  hint?: ReactNode
  children: ReactNode
}

function FieldShell({ children, error, hint, label }: FieldShellProps) {
  return (
    <label className={`ui-field${error ? ' ui-field-invalid' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="ui-field-error">{error}</small> : null}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function TextField({ error, label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: ReactNode; label: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <input aria-invalid={Boolean(error) || props['aria-invalid']} {...props} />
    </FieldShell>
  )
}

export function SelectField({ error, label, hint, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: ReactNode; label: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <select aria-invalid={Boolean(error) || props['aria-invalid']} {...props}>{children}</select>
    </FieldShell>
  )
}

export function TextareaField({ error, label, hint, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: ReactNode; label: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      <textarea aria-invalid={Boolean(error) || props['aria-invalid']} {...props} />
    </FieldShell>
  )
}
