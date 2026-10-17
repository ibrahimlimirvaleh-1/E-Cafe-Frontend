import { CreditCard, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { ecafeApi, type PaymentCapabilities, type ReservationPaymentSummary } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { paymentStatusLabel } from '../../shared/lib/paymentStatus'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type Props = {
  restaurantId: string
  reservationId: string
  amount?: string
}

type PaymentState = { capabilities: PaymentCapabilities | null; summary: ReservationPaymentSummary | null }

export function ManagerDepositPaymentPanel({ restaurantId, reservationId, amount }: Props) {
  const [revision, setRevision] = useState(0)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const { data, error, isLoading } = useKeyedAsyncData<PaymentState>(
    async () => {
      const [capabilities, summary] = await Promise.all([
        ecafeApi.reservationPayments.capabilities(),
        ecafeApi.reservationPayments.summary(reservationId),
      ])
      return { capabilities, summary }
    },
    { capabilities: null, summary: null },
    `${restaurantId}:${reservationId}`,
    [restaurantId, reservationId, revision],
  )

  async function authorize() {
    if (!data.capabilities?.enabled || !data.summary?.canAuthorize || isAuthorizing) return
    setFeedback('')
    setIsAuthorizing(true)
    try {
      await ecafeApi.reservationPayments.authorize(restaurantId, reservationId)
      setRevision((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (cause) {
      setFeedback(normalizeCaughtApiError(cause, 'Ödənişə icazə verilə bilmədi.').message)
    } finally {
      setIsAuthorizing(false)
    }
  }

  return (
    <section className="reservation-payment-panel" aria-label="Depozit ödənişi">
      <div className="reservation-payment-panel-header">
        <div className="reservation-payment-panel-icon"><CreditCard size={20} /></div>
        <div>
          <span className="section-eyebrow">DEPOZİT</span>
          <h2>Ödənişə icazə</h2>
          <p>Müştəri depoziti yalnız sistemdəki ödəniş addımı ilə tamamlayır.</p>
        </div>
      </div>
      <div className="reservation-payment-meta">
        <span><strong>Rezervasiya</strong><b>#{reservationId}</b></span>
        <span><strong>Depozit</strong><b>{amount || 'Serverdə yoxlanılır'}</b></span>
        <span><ShieldCheck size={16} /> Rekvizit mübadiləsi yoxdur</span>
      </div>
      {isLoading ? <p role="status">Ödəniş vəziyyəti yoxlanılır...</p> : null}
      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {data.capabilities && !data.capabilities.enabled ? (
        <StatusMessage tone="warning" autoHideMs={false}>{data.capabilities.message || 'Ödəniş xidməti hazırda aktiv deyil.'}</StatusMessage>
      ) : null}
      {data.capabilities?.enabled && data.capabilities.isTest ? (
        <StatusMessage tone="info" autoHideMs={false}>Test rejimi: real pul köçürülmür.</StatusMessage>
      ) : null}
      {data.summary?.latestPayment ? <p className="reservation-payment-state">Son ödəniş: {paymentStatusLabel(data.summary.latestPayment.statusId, data.summary.latestPayment.status)}</p> : null}
      {data.summary?.latestPayment?.isTest && !data.capabilities?.isTest ? <StatusMessage tone="info" autoHideMs={false}>Son ödəniş test qeydi idi; real pul tutulmayıb.</StatusMessage> : null}
      {data.capabilities?.enabled && data.summary && !data.summary.enabled ? <p className="reservation-payment-state">Bu rezervasiya üçün ödəniş addımı aktiv deyil.</p> : null}
      {feedback ? <StatusMessage tone="danger" autoHideMs={false}>{feedback}</StatusMessage> : null}
      {data.capabilities?.enabled && data.summary?.canAuthorize ? (
        <div className="reservation-payment-actions">
          <span>İcazə verildikdən sonra müştəri ödəniş addımını açacaq.</span>
          <Button disabled={isAuthorizing} onClick={() => void authorize()} type="button">
            <CreditCard size={17} /> {isAuthorizing ? 'İcazə verilir...' : 'Ödənişə icazə ver'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
