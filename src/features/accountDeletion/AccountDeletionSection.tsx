import { RefreshCw, Trash2, X } from 'lucide-react'
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
import './account-deletion.css'

const blockerKeys: Record<string, string> = {
  ActiveStaffProfile: 'activeStaff', ActiveReservation: 'activeReservation', OpenTableSession: 'openSession',
  PendingPayment: 'pendingPayment', PendingRefund: 'pendingRefund', UnpaidBill: 'unpaidBill',
  WalletBalance: 'walletBalance', UnresolvedOrder: 'unresolvedOrder',
}
type Eligibility = { canDelete: boolean; blockers: string[] }
type Scope = { key: string; active: boolean; check: AbortController | null; submit: AbortController | null }

export function AccountDeletionSection() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  return <div className="account-deletion-section">
    <h3>{t('ui.accountDeletion.title')}</h3>
    <p>{t('ui.accountDeletion.description')}</p>
    <Button type="button" variant="danger" onClick={() => setOpen(true)}><Trash2 size={18} aria-hidden="true" />{t('ui.accountDeletion.action')}</Button>
    {open ? <AccountDeletionDialog retryAt={retryAt} onRetryAt={setRetryAt} onClose={() => setOpen(false)} /> : null}
  </div>
}

function AccountDeletionDialog({ retryAt, onRetryAt, onClose }: { retryAt: number; onRetryAt: (value: number) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const { user, scopeRevision, completeAccountDeletion, clearSession, isCurrentSession } = useAuth()
  const epoch = scopeRevision.split(':')[0]
  const key = `${user?.userId}:${user?.roleId}:${user?.restaurantId}:${scopeRevision}`
  const ownerRef = useRef<Scope>({ key, active: true, check: null, submit: null })
  if (ownerRef.current.key !== key) ownerRef.current = { key, active: true, check: null, submit: null }
  const scope = ownerRef.current
  const dialog = useRef<HTMLDialogElement>(null)
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [checking, setChecking] = useState(true)
  const [pending, setPending] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [now, setNow] = useState(Date.now())
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000))
  const canDelete = eligibility?.canDelete === true && eligibility.blockers.length === 0 && !checking && !checkError
  const isCurrent = (controller: AbortController) => scope.active && ownerRef.current === scope && !controller.signal.aborted

  async function checkEligibility() {
    if (!user || !scope.active || ownerRef.current !== scope || !isCurrentSession(user.userId, epoch)) return
    scope.check?.abort()
    const controller = new AbortController()
    scope.check = controller
    setChecking(true)
    setEligibility(null)
    setCheckError('')
    try {
      const result = await ecafeApi.profile.accountDeletionEligibility(controller.signal)
      if (isCurrent(controller)) setEligibility(result)
    } catch (error) {
      if (isCurrent(controller)) setCheckError(errorKey(error, true))
    } finally {
      if (isCurrent(controller)) { scope.check = null; setChecking(false) }
    }
  }

  useEffect(() => {
    scope.active = true
    const node = dialog.current!
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node.showModal()
    setPassword(''); setConfirmed(false); setPending(false); setSubmitError('')
    void checkEligibility()
    return () => {
      scope.active = false
      scope.check?.abort(); scope.submit?.abort()
      node.close()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
    // Each owner boundary must dispose its own requests, including A-B-A transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  useEffect(() => {
    if (retryAt <= Date.now()) return
    const timer = window.setInterval(() => { const time = Date.now(); setNow(time); if (time >= retryAt) window.clearInterval(timer) }, 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (scope.submit || !scope.active || ownerRef.current !== scope || !user || !isCurrentSession(user.userId, epoch) || !canDelete || !password || !confirmed || remaining) return
    const controller = new AbortController()
    scope.submit = controller
    const ownerId = user.userId
    const currentPassword = password
    setPassword(''); setConfirmed(false); setPending(true); setSubmitError('')
    try {
      await ecafeApi.profile.deleteOwnAccount({ currentPassword, confirm: true }, controller.signal)
      if (isCurrent(controller)) completeAccountDeletion(ownerId, epoch)
    } catch (error) {
      if (!isCurrent(controller)) return
      const code = error instanceof ApiError ? String(error.code) : ''
      setSubmitError(errorKey(error))
      if (error instanceof ApiError && (error.statusCode === 429 || code === 'TooManyRequests' || code === 'AccountTemporarilyLocked')) {
        onRetryAt(Date.now() + 60_000); setNow(Date.now())
      }
      if (error instanceof ApiError && (error.statusCode === 409 || code === 'AccountDeletionBlocked' || code === '1143')) await checkEligibility()
      if (code === 'AccountDeletionCustomerOnly' || code === '1142') setEligibility(null)
    } finally {
      if (isCurrent(controller)) { scope.submit = null; setPending(false) }
    }
  }

  const feedback = checkError || submitError
  const blocked = eligibility && (!eligibility.canDelete || eligibility.blockers.length > 0)
  return createPortal(<dialog ref={dialog} className="account-deletion-dialog" aria-labelledby="account-deletion-title" aria-describedby="account-deletion-description"
    onCancel={event => { event.preventDefault(); if (!scope.submit) onClose() }}>
    <form onSubmit={submit} aria-busy={pending || checking}>
      <header><Trash2 size={22} aria-hidden="true" /><button type="button" disabled={pending} onClick={onClose} aria-label={t('ui.common.close')} title={t('ui.common.close')}><X size={20} /></button></header>
      <h2 id="account-deletion-title">{t('ui.accountDeletion.action')}</h2>
      <p className="account-deletion-owner">{user?.email}</p>
      <p id="account-deletion-description">{t('ui.accountDeletion.description')}</p>
      {checking ? <p role="status">{t('ui.accountDeletion.checking')}</p> : null}
      {blocked ? <section className="account-deletion-blockers" aria-labelledby="account-deletion-blockers-title">
        <h3 id="account-deletion-blockers-title">{t('ui.accountDeletion.blocked')}</h3>
        <ul>{[...new Set(eligibility.blockers.length ? eligibility.blockers : ['Unknown'])].map(blocker => <li key={blocker}>{t(`ui.accountDeletion.${blockerKeys[blocker] || 'unknownBlocker'}`)}</li>)}</ul>
      </section> : null}
      {canDelete ? <>
        <TextField label={t('ui.accountDeletion.password')} type="password" autoComplete="current-password" required disabled={pending} value={password} onChange={event => setPassword(event.target.value)} />
        <label className="account-deletion-confirm"><input type="checkbox" required disabled={pending} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{t('ui.accountDeletion.confirm')}</span></label>
      </> : null}
      {feedback ? <StatusMessage key={feedback} tone="danger" autoHideMs={false} dismissible={false}>{t(`ui.accountDeletion.${feedback}`)}</StatusMessage> : null}
      {feedback === 'sessionExpired' ? <Link to="/login" onClick={clearSession}>{t('ui.accountDeletion.login')}</Link> : null}
      {!checking && (blocked || checkError) ? <Button type="button" variant="secondary" disabled={pending} onClick={() => void checkEligibility()}><RefreshCw size={18} aria-hidden="true" />{t('ui.accountDeletion.recheck')}</Button> : null}
      <footer><Button type="button" variant="secondary" disabled={pending} onClick={onClose}>{t('ui.common.cancel')}</Button>
        <Button type="submit" variant="danger" disabled={pending || !canDelete || !password || !confirmed || remaining > 0}><Trash2 size={18} aria-hidden="true" />{pending ? t('ui.accountDeletion.deleting') : remaining ? t('ui.accountDeletion.retryIn', { seconds: remaining }) : t('ui.accountDeletion.action')}</Button></footer>
    </form>
  </dialog>, document.body)
}

function errorKey(error: unknown, checking = false) {
  const code = error instanceof ApiError ? String(error.code) : ''
  const status = error instanceof ApiError ? error.statusCode : 0
  if (code === 'InvalidCredentials') return 'invalidPassword'
  if (code === 'AccountTemporarilyLocked') return 'locked'
  if (status === 429 || code === 'TooManyRequests') return 'rateLimited'
  if (code === 'AccountDeletionCustomerOnly' || code === '1142' || status === 403) return 'customerOnly'
  if (code === 'AccountDeletionBlocked' || code === '1143' || status === 409) return 'changed'
  if (status === 401 || code === 'SessionInvalid') return 'sessionExpired'
  return checking ? 'checkFailed' : 'failed'
}
