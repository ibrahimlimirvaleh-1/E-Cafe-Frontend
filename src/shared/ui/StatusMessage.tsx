import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type StatusMessageTone = 'success' | 'warning' | 'danger' | 'info'

type StatusMessageProps = {
  autoHideMs?: number | false
  dismissible?: boolean
  children: ReactNode
  className?: string
  details?: {
    field?: string
    label?: string
    message: string
  }[]
  tone?: StatusMessageTone
}

const warningWords = ['seçilməlidir', 'secil', 'required', 'tapılmadı', 'tapilmadi', 'yoxdur']
const dangerWords = [
  'failed',
  'error',
  'xəta',
  'xeta',
  'uğursuz',
  'olunmadı',
  'edilmədi',
  'yenilənmədi',
  'yenilenmedi',
  'yaradılmadı',
  'yaradilmadi',
  'icazəniz yoxdur',
  'icazeniz yoxdur',
  'already exists',
  'mövcuddur',
  'movcuddur',
]

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

function messageText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(messageText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return messageText(node.props.children)
  return ''
}

export function StatusMessage({ autoHideMs, dismissible = true, children, className = '', details = [], tone }: StatusMessageProps) {
  const { t } = useTranslation()
  const messageRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(Boolean(children))
  const resolvedTone = tone ?? (details.length > 0 ? 'danger' : inferTone(children))
  const Icon = resolvedTone === 'success' ? CheckCircle2 : resolvedTone === 'danger' ? AlertTriangle : Info
  const resolvedAutoHideMs = autoHideMs ?? (dismissible && details.length === 0
    ? resolvedTone === 'success' ? 5500 : resolvedTone === 'info' ? 7000 : false
    : false)
  const identity = `${messageText(children)}:${details.map((detail) => `${detail.field ?? ''}:${detail.message}`).join('|')}`

  useEffect(() => {
    setIsVisible(Boolean(children))
  }, [identity, children ? true : false])

  useEffect(() => {
    const node = messageRef.current
    if (!node || !isVisible || resolvedAutoHideMs === false) return
    let remaining = resolvedAutoHideMs
    let startedAt = 0
    let timerId: number | null = null
    let hovered = node.matches(':hover')
    let focused = node.contains(document.activeElement)

    function pause() {
      if (timerId === null) return
      window.clearTimeout(timerId)
      timerId = null
      remaining = Math.max(0, remaining - (performance.now() - startedAt))
    }
    function resume() {
      if (hovered || focused || document.hidden || timerId !== null) return
      startedAt = performance.now()
      timerId = window.setTimeout(() => setIsVisible(false), remaining)
    }
    const onEnter = () => { hovered = true; pause() }
    const onLeave = () => { hovered = false; resume() }
    const onFocusIn = () => { focused = true; pause() }
    const onFocusOut = (event: FocusEvent) => { focused = node.contains(event.relatedTarget as Node | null); resume() }
    const onVisibilityChange = () => { if (document.hidden) pause(); else resume() }

    node.addEventListener('mouseenter', onEnter)
    node.addEventListener('mouseleave', onLeave)
    node.addEventListener('focusin', onFocusIn)
    node.addEventListener('focusout', onFocusOut)
    document.addEventListener('visibilitychange', onVisibilityChange)
    resume()
    return () => {
      pause()
      node.removeEventListener('mouseenter', onEnter)
      node.removeEventListener('mouseleave', onLeave)
      node.removeEventListener('focusin', onFocusIn)
      node.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [identity, isVisible, resolvedAutoHideMs])

  if (!isVisible) {
    return null
  }

  // Forms use one feedback component so save/error states look consistent across admin pages.
  return (
    <div ref={messageRef} className={`form-message form-message-${resolvedTone} ${className}`.trim()} role={resolvedTone === 'danger' ? 'alert' : 'status'}>
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
      {dismissible ? (
        <button aria-label={t('ui.message.close')} className="form-message-close" onClick={() => setIsVisible(false)} type="button">
          <X size={18} />
        </button>
      ) : null}
    </div>
  )
}
