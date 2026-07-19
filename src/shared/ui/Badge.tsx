import type { ReactNode } from 'react'
import type { StatusTone } from '../../entities/types'

type BadgeProps = {
  children: ReactNode
  tone?: StatusTone
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>
}
