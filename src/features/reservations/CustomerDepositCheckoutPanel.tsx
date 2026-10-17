import { CreditCard, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ecafeApi, type PaymentCapabilities, type ReservationPaymentSummary } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { paymentStatusId, paymentStatusLabel } from '../../shared/lib/paymentStatus'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type Props = { restaurantId: string; reservationId: string; amount: number; onChanged?: () => void }
type PaymentState = { capabilities: PaymentCapabilities | null; summary: ReservationPaymentSummary | null }
type TestOutcome = 'Succeeded' | 'Failed' | 'Cancelled'

function checkoutKey(scope: string) { return `ecafe:checkout-intent:${scope}` }

type CheckoutIntent = { key: string; previousPaymentId: number | null }

function getIntentKey(scope: string, previousPaymentId: number | null) {
  const key = checkoutKey(scope)
  const existing = window.sessionStorage.getItem(key)
  if (existing) {
    try {
      const intent = JSON.parse(existing) as CheckoutIntent
      if (intent.key && intent.previousPaymentId === previousPaymentId) return intent.key
    } catch { /* An invalid old intent cannot be reused. */ }
  }
  const created = crypto.randomUUID()
  window.sessionStorage.setItem(key, JSON.stringify({ key: created, previousPaymentId } satisfies CheckoutIntent))
  return created
}

export function CustomerDepositCheckoutPanel({ restaurantId, reservationId, amount, onChanged }: Props) {
  const { user } = useAuth()
  const scope = `${user?.userId || ''}:${restaurantId}:${reservationId}`
  const previousScope = useRef(scope)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    if (previousScope.current !== scope) {
      window.sessionStorage.removeItem(checkoutKey(previousScope.current))
      previousScope.current = scope
    }
  }, [scope])
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])
  const { data, error, isLoading } = useKeyedAsyncData<PaymentState>(
    async () => {
      const [capabilities, summary] = await Promise.all([
        ecafeApi.reservationPayments.capabilities(),
        ecafeApi.reservationPayments.summary(reservationId),
      ])
      return { capabilities, summary }
    },
    { capabilities: null, summary: null },
    scope,
    [scope, revision],
  )
  const payment = data.summary?.latestPayment
  const isTest = Boolean(data.capabilities?.enabled && data.capabilities.isTest && data.summary?.isTest && payment?.isTest)
  const canSimulate = isTest && payment?.statusId === paymentStatusId.pending
  const canCheckout = Boolean(data.summary?.canPay && (!payment || payment.statusId === paymentStatusId.failed || payment.statusId === paymentStatusId.cancelled))

  function openCheckout(url: string) {
    try {
      const target = new URL(url)
      if (target.protocol !== 'https:') throw new Error('Ödəniş ünvanı təhlükəsiz deyil.')
      window.location.assign(target.href)
    } catch (cause) {
      setFeedback(normalizeCaughtApiError(cause, 'Ödəniş səhifəsi açıla bilmədi.').message)
    }
  }

  async function checkout() {
    if (!data.capabilities?.enabled || !canCheckout || busy) return
    setFeedback('')
    setBusy(true)
    try {
      const result = await ecafeApi.reservationPayments.checkout(reservationId, getIntentKey(scope, payment?.id ?? null))
      window.sessionStorage.removeItem(checkoutKey(scope))
      setRevision((value) => value + 1)
      onChanged?.()
      if (!result.isTest && result.checkoutUrl) openCheckout(result.checkoutUrl)
    } catch (cause) {
      setFeedback(normalizeCaughtApiError(cause, 'Ödəniş addımı açıla bilmədi. Yenidən yoxlayın.').message)
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    if (!payment || busy) return
    setFeedback('')
    setBusy(true)
    try {
      await ecafeApi.reservationPayments.refresh(payment.id)
      setRevision((value) => value + 1)
      onChanged?.()
    } catch (cause) {
      setFeedback(normalizeCaughtApiError(cause, 'Ödənişin vəziyyəti yoxlanılmadı.').message)
    } finally {
      setBusy(false)
    }
  }

  async function simulate(outcome: TestOutcome) {
    if (!canSimulate || !payment || busy) return
    setFeedback('')
    setBusy(true)
    try {
      await ecafeApi.reservationPayments.testOutcome(payment.id, outcome)
      setRevision((value) => value + 1)
      onChanged?.()
    } catch (cause) {
      setFeedback(normalizeCaughtApiError(cause, 'Test nəticəsi qeydə alınmadı.').message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="reservation-proof-panel reservation-checkout-panel" aria-label="Depozit ödənişi">
      <div className="reservation-proof-header">
        <div className="reservation-proof-icon"><CreditCard size={20} /></div>
        <div><span className="section-eyebrow">DEPOZİT</span><h3>Depozit ödənişi</h3><p>{amount.toFixed(2)} AZN</p></div>
      </div>
      {isLoading ? <p role="status">Ödəniş vəziyyəti yoxlanılır...</p> : null}
      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {data.capabilities && !data.capabilities.enabled ? (
        <StatusMessage tone="warning" autoHideMs={false}>{data.capabilities.message || 'Ödəniş xidməti hazırda aktiv deyil.'}</StatusMessage>
      ) : null}
      {data.capabilities?.enabled && data.capabilities.isTest ? (
        <StatusMessage tone="info" autoHideMs={false}>Test ödənişi: real kart məlumatı daxil etməyin. Pul tutulmur.</StatusMessage>
      ) : null}
      {payment?.isTest && !data.capabilities?.isTest ? <StatusMessage tone="info" autoHideMs={false}>Bu qeyd əvvəlki test ödənişinə aiddir; real pul tutulmayıb.</StatusMessage> : null}
      {payment ? (
        <div className="reservation-checkout-status">
          <span>Ödəniş vəziyyəti</span><strong>{paymentStatusLabel(payment.statusId, payment.status)}</strong>
          {payment.expiresAt ? <small>Son vaxt: {formatReservationDateTime(payment.expiresAt)}</small> : null}
          {payment.requiresRefund ? <small>Bu ödəniş üçün geri ödəniş prosesi tələb olunur.</small> : null}
        </div>
      ) : null}
      {feedback ? <StatusMessage tone="danger" autoHideMs={false}>{feedback}</StatusMessage> : null}
      {data.capabilities?.enabled ? (
        <div className="reservation-checkout-actions">
          {canCheckout ? <Button disabled={busy} onClick={() => void checkout()} type="button"><CreditCard size={17} /> {busy ? 'Açılır...' : data.capabilities.isTest ? 'Test checkout yarat' : 'Ödənişə keç'}</Button> : null}
          {payment?.checkoutUrl && !payment.isTest && !data.capabilities?.isTest && payment.statusId === paymentStatusId.pending ? (
            <Button disabled={busy} onClick={() => openCheckout(payment.checkoutUrl!)} type="button"><CreditCard size={17} /> Ödənişə davam et</Button>
          ) : null}
          {payment ? <Button disabled={busy} onClick={() => void refresh()} type="button" variant="secondary"><RefreshCw size={17} /> Vəziyyəti yoxla</Button> : null}
        </div>
      ) : null}
      {data.capabilities?.enabled && data.summary && !data.summary.enabled ? <p className="reservation-payment-state">Bu rezervasiya üçün ödəniş addımı aktiv deyil.</p> : null}
      {data.capabilities?.enabled && data.summary?.enabled && !canCheckout && !payment ? <p className="reservation-payment-state">Bu rezervasiya üçün hazırda ödəniş addımı yoxdur.</p> : null}
      {canSimulate ? (
        <div className="reservation-checkout-test" aria-label="Yalnız test nəticələri">
          <strong>Test ssenarisi</strong>
          <div className="reservation-checkout-actions">
            <Button disabled={busy} onClick={() => void simulate('Succeeded')} type="button">Uğurlu</Button>
            <Button disabled={busy} onClick={() => void simulate('Failed')} type="button" variant="secondary">Uğursuz</Button>
            <Button disabled={busy} onClick={() => void simulate('Cancelled')} type="button" variant="secondary">Ləğv</Button>
          </div>
        </div>
      ) : null}
      <p className="reservation-checkout-footnote"><ShieldCheck size={16} /> Ödəniş yalnız server təsdiq etdikdən sonra tamamlanmış sayılır.</p>
    </section>
  )
}
