import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type ActionTone = 'neutral' | 'danger'

type ActionIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tone?: ActionTone
}

type ActionIconLinkProps = LinkProps & {
  children: ReactNode
  label: string
  tone?: ActionTone
}

function actionClassName(tone: ActionTone, className = '') {
  return `action-icon-button action-icon-button-${tone} ${className}`.trim()
}

export function ActionIconButton({ children, className, label, tone = 'neutral', title, ...props }: ActionIconButtonProps) {
  return (
    <button aria-label={label} className={actionClassName(tone, className)} title={title ?? label} type="button" {...props}>
      {children}
    </button>
  )
}

export function ActionIconLink({ children, className, label, tone = 'neutral', title, ...props }: ActionIconLinkProps) {
  return (
    <Link aria-label={label} className={actionClassName(tone, className)} title={title ?? label} {...props}>
      {children}
    </Link>
  )
}
