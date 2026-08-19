import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

type EmptyStateProps = {
  action?: ReactNode
  message: string
  title: string
}

export function EmptyState({ action, message, title }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <span>
        <Inbox size={22} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {action}
    </section>
  )
}
