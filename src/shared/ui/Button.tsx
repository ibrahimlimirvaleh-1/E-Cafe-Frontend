import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

type ButtonLinkProps = {
  children: ReactNode
  to: string
  variant?: ButtonVariant
  className?: string
}

export function Button({ className = '', variant = 'primary', ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ${className}`} {...props} />
}

export function ButtonLink({ children, className = '', to, variant = 'primary' }: ButtonLinkProps) {
  return (
    <Link className={`ui-button ui-button-${variant} ${className}`} to={to}>
      {children}
    </Link>
  )
}
