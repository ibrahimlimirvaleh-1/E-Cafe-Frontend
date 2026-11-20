import { Mail, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { ApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './email-change.css'

export function EmailChangeDialog({ onClose, retryAt, onRetryAt }: {
  onClose: () => void; retryAt: number; onRetryAt: (value: number) => void
}) {
  const { t } = useTranslation()
  const { user, clearSession } = useAuth()
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<AbortController | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [errorKey, setErrorKey] = useState('')
  const [now, setNow] = useState(Date.now())
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000))

  useEffect(() => {
    const node = dialog.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node.showModal()
    return () => {
      request.current?.abort()
      node.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (retryAt <= Date.now()) return
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= retryAt) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (request.current || pending || remaining || !user) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setAccepted(false)
    setErrorKey('')
    const currentPassword = password
    setPassword('')
    try {
      await ecafeApi.profile.requestEmailChange({ newEmail: newEmail.trim(), currentPassword }, controller.signal)
      if (controller.signal.aborted) return
      setAccepted(true)
      onRetryAt(Date.now() + 60_000)
      setNow(Date.now())
    } catch (error) {
      if (controller.signal.aborted) return
      const code = error instanceof ApiError ? error.code : undefined
      const status = error instanceof ApiError ? error.statusCode : 0
      if (status === 429 || code === 'TooManyRequests') {
        onRetryAt(Date.now() + 60_000)
        setNow(Date.now())
        setErrorKey('ui.emailChange.rateLimited')
      } else if (code === 'InvalidCredentials') setErrorKey('ui.emailChange.invalidPassword')
      else if (status === 401 || code === 'SessionInvalid') setErrorKey('ui.emailChange.requestLoginRequired')
      else setErrorKey('ui.emailChange.requestFailed')
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setPending(false)
      }
    }
  }

  return createPortal(<dialog ref={dialog} className="email-change-dialog" aria-labelledby="email-change-title" aria-describedby="email-change-description"
    onCancel={event => { event.preventDefault(); if (!request.current) onClose() }}>
    <form onSubmit={submit} aria-busy={pending}>
      <header><Mail size={22} aria-hidden="true" /><button type="button" disabled={pending} onClick={onClose} aria-label={t('ui.common.close')} title={t('ui.common.close')}><X size={20} /></button></header>
      <h2 id="email-change-title">{t('ui.emailChange.change')}</h2>
      <p id="email-change-description">{t('ui.emailChange.description')}</p>
      <TextField label={t('ui.emailChange.newEmail')} type="email" autoComplete="email" maxLength={254} required disabled={pending} value={newEmail} onChange={event => setNewEmail(event.target.value)} />
      <TextField label={t('ui.emailChange.password')} type="password" autoComplete="current-password" required disabled={pending} value={password} onChange={event => setPassword(event.target.value)} />
      {accepted ? <StatusMessage tone="success" autoHideMs={false} dismissible={false}>{t('ui.emailChange.accepted')}</StatusMessage> : null}
      {errorKey ? <StatusMessage tone="danger" autoHideMs={false} dismissible={false}>{t(errorKey)}</StatusMessage> : null}
      {errorKey === 'ui.emailChange.requestLoginRequired' ? <Link to="/login" onClick={clearSession}>{t('ui.emailChange.login')}</Link> : null}
      <footer><Button type="button" variant="secondary" disabled={pending} onClick={onClose}>{t('ui.common.cancel')}</Button>
        <Button type="submit" disabled={pending || remaining > 0 || !password || !newEmail}>
          <Mail size={18} aria-hidden="true" />{pending ? t('ui.emailChange.sending') : remaining ? t('ui.emailChange.retryIn', { seconds: remaining }) : t(accepted ? 'ui.emailChange.resend' : 'ui.emailChange.send')}
        </Button></footer>
    </form>
  </dialog>, document.body)
}
