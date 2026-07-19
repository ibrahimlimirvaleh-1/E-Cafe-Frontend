import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type FieldShellProps = {
  label: string
  hint?: ReactNode
  children: ReactNode
}

function FieldShell({ children, hint, label }: FieldShellProps) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function TextField({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} hint={hint}>
      <input {...props} />
    </FieldShell>
  )
}

export function SelectField({ label, hint, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} hint={hint}>
      <select {...props}>{children}</select>
    </FieldShell>
  )
}

export function TextareaField({ label, hint, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} hint={hint}>
      <textarea {...props} />
    </FieldShell>
  )
}
