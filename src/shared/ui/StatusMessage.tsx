import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

type StatusMessageTone = 'success' | 'warning' | 'danger' | 'info'

type StatusMessageProps = {
  children: ReactNode
  className?: string
  tone?: StatusMessageTone
}

const warningWords = ['secil', 'required', 'tapilmadi', 'yoxdur']
const dangerWords = ['failed', 'error', 'xeta', 'yenilenmedi', 'icazeniz yoxdur']

function inferTone(children: ReactNode): StatusMessageTone {
  const message = typeof children === 'string' ? children.toLowerCase() : ''

  if (dangerWords.some((word) => message.includes(word))) {
    return 'danger'
  }

  if (warningWords.some((word) => message.includes(word))) {
    return 'warning'
  }

  return 'success'
}

export function StatusMessage({ children, className = '', tone }: StatusMessageProps) {
  const resolvedTone = tone ?? inferTone(children)
  const Icon = resolvedTone === 'success' ? CheckCircle2 : resolvedTone === 'danger' ? AlertTriangle : Info

  // Forms use one feedback component so save/error states do not look like plain page text.
  return (
    <p className={`form-message form-message-${resolvedTone} ${className}`.trim()} role="status">
      <Icon size={18} />
      <span>{children}</span>
    </p>
  )
}
