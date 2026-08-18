import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

type StatusMessageTone = 'success' | 'warning' | 'danger' | 'info'

type StatusMessageProps = {
  children: ReactNode
  className?: string
  details?: {
    field?: string
    label?: string
    message: string
  }[]
  tone?: StatusMessageTone
}

const warningWords = ['secil', 'required', 'tapilmadi', 'yoxdur']
const dangerWords = ['failed', 'error', 'xeta', 'yenilenmedi', 'yaradilmadi', 'icazeniz yoxdur', 'already exists', 'movcuddur']

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

export function StatusMessage({ children, className = '', details = [], tone }: StatusMessageProps) {
  const [isVisible, setIsVisible] = useState(Boolean(children))
  const resolvedTone = tone ?? inferTone(children)
  const Icon = resolvedTone === 'success' ? CheckCircle2 : resolvedTone === 'danger' ? AlertTriangle : Info

  useEffect(() => {
    setIsVisible(Boolean(children))
  }, [children])

  if (!isVisible) {
    return null
  }

  // Forms use one feedback component so save/error states look consistent across admin pages.
  return (
    <div className={`form-message form-message-${resolvedTone} ${className}`.trim()} role="status">
      <span className="form-message-icon">
        <Icon size={18} />
      </span>
      <span className="form-message-content">
        <span className="form-message-title">{children}</span>
        {details.length > 0 ? (
          <ul className="form-message-details">
            {details.map((detail, index) => (
              <li key={`${detail.field ?? detail.message}-${index}`}>
                {detail.label ? <strong>{detail.label}: </strong> : null}
                {detail.message}
              </li>
            ))}
          </ul>
        ) : null}
      </span>
      <button aria-label="Mesajı bağla" className="form-message-close" onClick={() => setIsVisible(false)} type="button">
        <X size={18} />
      </button>
    </div>
  )
}
