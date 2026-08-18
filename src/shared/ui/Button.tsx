import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

type ButtonLinkProps = LinkProps & {
  children: ReactNode
  variant?: ButtonVariant
}

export function Button({ className = '', variant = 'primary', ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ${className}`} {...props} />
}

export function ButtonLink({ children, className = '', variant = 'primary', ...props }: ButtonLinkProps) {
  return (
    <Link className={`ui-button ui-button-${variant} ${className}`} {...props}>
      {children}
    </Link>
  )
}
