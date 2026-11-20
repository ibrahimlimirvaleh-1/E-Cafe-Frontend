import { useEffect, useRef, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { ApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { Brand } from '../../shared/layout/Brand'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { discardConfirmationToken, readConfirmationToken } from '../../features/emailChange/confirmationToken'
import '../../features/emailChange/email-change.css'

export function ConfirmEmailChangePage() {
  const { t } = useTranslation()
  const { user, isAuthReady, clearSession } = useAuth()
  const [token, setToken] = useState(readConfirmationToken)
  const [owner, setOwner] = useState<string | null>(null)
  const [state, setState] = useState<'ready' | 'pending' | 'success' | 'invalid' | 'login' | 'failed' | 'limited'>('ready')
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    discardConfirmationToken()
    return () => { request.current?.abort() }
  }, [])

  useEffect(() => {
    if (!isAuthReady || state === 'success') return
    if (!user || (owner && owner !== user.userId)) {
      request.current?.abort()
      setToken('')
      setState('login')
    } else if (!owner) setOwner(user.userId)
  }, [isAuthReady, user?.userId, owner, state])

  async function confirm() {
    if (!token || !user || !isAuthReady || owner !== user.userId || request.current) return
    const controller = new AbortController()
    request.current = controller
    setState('pending')
    try {
      await ecafeApi.profile.confirmEmailChange(token, controller.signal)
      if (controller.signal.aborted) return
      setToken('')
      setState('success')
      clearSession()
    } catch (error) {
      if (controller.signal.aborted) return
      const code = error instanceof ApiError ? error.code : undefined
      const status = error instanceof ApiError ? error.statusCode : 0
      if (status === 401 || code === 'SessionInvalid') {
        setToken(''); setState('login')
      } else if (code === 'EmailChangeInvalidOrExpired' || status === 400 || status === 403 || status === 404 || status === 409) {
        setToken(''); setState('invalid')
      } else if (status === 429 || code === 'TooManyRequests') {
        setToken(''); setState('limited')
      } else setState('failed')
    } finally {
      if (!controller.signal.aborted) request.current = null
    }
  }

  const needsLogin = state === 'login'
  const invalid = !token && state !== 'success' && !needsLogin
  const messageKey = state === 'success' ? 'success' : needsLogin ? 'loginRequired' : state === 'limited' ? 'rateLimited' : invalid ? 'invalidLink' : state === 'failed' ? 'confirmFailed' : ''
  return <main className="auth-page"><section className="auth-card email-change-confirm" aria-busy={!isAuthReady || state === 'pending'}>
    <Brand />
    <span className="email-change-symbol"><MailCheck size={24} aria-hidden="true" /></span>
    <h1>{t('ui.emailChange.confirmTitle')}</h1>
    {!messageKey ? <p>{t(isAuthReady ? 'ui.emailChange.confirmDescription' : 'ui.emailChange.checkingSession')}</p> : null}
    {user && token && state !== 'success' ? <p className="email-change-account">{user.email}</p> : null}
    {messageKey ? <StatusMessage tone={state === 'success' ? 'success' : needsLogin ? 'info' : 'danger'} autoHideMs={false} dismissible={false}>{t(`ui.emailChange.${messageKey}`)}</StatusMessage> : null}
    {token && user && !needsLogin && state !== 'success' ? <Button type="button" disabled={!isAuthReady || state === 'pending' || owner !== user.userId} onClick={() => void confirm()}>
      <MailCheck size={18} aria-hidden="true" />{t(state === 'pending' ? 'ui.emailChange.confirming' : 'ui.emailChange.confirm')}
    </Button> : null}
    {needsLogin || state === 'success' ? <Link className="ui-button ui-button-primary" to="/login" onClick={clearSession}>{t('ui.emailChange.login')}</Link> : isAuthReady && state !== 'pending' ? <Link to="/account">{t('ui.emailChange.backToProfile')}</Link> : null}
  </section></main>
}
