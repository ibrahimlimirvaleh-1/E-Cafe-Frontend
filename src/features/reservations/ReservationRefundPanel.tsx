import { RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { WorkflowAction } from '../../entities/types'
import { ecafeApi, type PaymentCapabilities, type ReservationRefundRequestInfo, type ReservationRefundResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { ReservationReasonDialog } from './ReservationReasonDialog'
import { RefundHistory } from './RefundHistory'

type Props = {
  reservationId: number
  restaurantId: number
  reservationStatusId: number
  reservationFlowCode: string
  refundRequest?: ReservationRefundRequestInfo | null
}

export function ReservationRefundPanel({ reservationId, restaurantId, reservationStatusId, reservationFlowCode, refundRequest }: Props) {
  const [reloadKey, setReloadKey] = useState(0)
  const [isRequestOpen, setIsRequestOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])
  const { data: refund, error, hasData, isLoading } = useKeyedAsyncData<ReservationRefundResponse | null>(
    () => ecafeApi.reservations.getRefund(String(reservationId)),
    null,
    String(reservationId),
    [reservationId, reloadKey],
  )
  const { data: paymentCapabilities } = useKeyedAsyncData<PaymentCapabilities | null>(
    () => ecafeApi.reservationPayments.capabilities(),
    null,
    String(reservationId),
    [reservationId],
  )
  const { data: actions, isLoading: areActionsLoading } = useKeyedAsyncData<WorkflowAction[]>(
    () => !isLoading && !refund
      ? ecafeApi.workflow.actions({
          flowCode: reservationFlowCode,
          statusId: reservationStatusId,
          restaurantId: String(restaurantId),
          entityId: String(reservationId),
        })
      : Promise.resolve([]),
    [],
    `${restaurantId}:${reservationId}:${refund?.id || ''}:${reservationStatusId}:${reservationFlowCode}`,
    [restaurantId, reservationId, reservationStatusId, reservationFlowCode, refund?.id, isLoading, reloadKey],
  )

  useEffect(() => {
    if (isLoading || window.location.hash !== '#refund') return
    const frame = window.requestAnimationFrame(() => document.getElementById('refund')?.scrollIntoView({ block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [isLoading, reservationId, Boolean(refund), Boolean(refundRequest)])

  const requestAction = !refund && !areActionsLoading ? actions.find((action) => action.code === 'requestRefund') : null

  async function requestRefund() {
    if (!requestAction || isSubmitting) return
    setActionError('')
    setIsSubmitting(true)
    try {
      await ecafeApi.workflow.executeAction({ action: requestAction })
      setIsRequestOpen(false)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (cause) {
      setActionError(normalizeCaughtApiError(cause, 'Geri ödəniş sorğusu göndərilmədi.').message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function simulate(outcome: 'Succeeded' | 'Failed' | 'Pending') {
    if (!paymentCapabilities?.enabled || !paymentCapabilities.isTest || !refund?.isTest || !refund.canSimulate || isSubmitting) return
    setActionError('')
    setIsSubmitting(true)
    try {
      await ecafeApi.reservationPayments.refundTestOutcome(refund.id, outcome)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (cause) {
      setActionError(normalizeCaughtApiError(cause, 'Test geri ödənişi yenilənmədi.').message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || (error && !hasData)) {
    return error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null
  }
  if (!refund && !requestAction && !refundRequest) return null

  return (
    <section className="reservation-refund-panel" id="refund" aria-label="Geri ödəniş">
      {error ? <StatusMessage tone="warning" autoHideMs={false}>{error}</StatusMessage> : null}
      <div className="reservation-refund-heading">
        <div><span className="section-eyebrow">GERİ ÖDƏNİŞ</span><h2>Geri ödəniş</h2></div>
        {refund || refundRequest ? <strong>{(refund?.amount ?? refundRequest!.amount).toFixed(2)} {refund?.currencyCode ?? refundRequest!.currencyCode}</strong> : null}
      </div>
      {!refund && refundRequest ? <StatusMessage tone="info" autoHideMs={false} dismissible={false}>{refundRequest.message}</StatusMessage> : null}
      {refund ? <p className="reservation-refund-status" role="status">{refund.status}</p> : null}
      {refund?.requiresManualReview ? (
        <StatusMessage tone="warning" autoHideMs={false}>Bu köhnə ödəniş provayderə bağlı deyil. Geri ödəniş ayrıca yoxlanmalıdır; avtomatik köçürmə təsdiqlənməyib.</StatusMessage>
      ) : refund?.customerNextStep ? <p className="reservation-refund-meta">{refund.customerNextStep}</p> : null}
      {refund?.eligibilityReason ? <p className="reservation-refund-meta">{refund.eligibilityReason}</p> : null}
      {refund?.isTest ? <StatusMessage tone="info" autoHideMs={false}>Test geri ödənişi: real pul köçürülmür.</StatusMessage> : null}
      {requestAction ? <div className="reservation-refund-actions"><Button disabled={isSubmitting} onClick={() => setIsRequestOpen(true)}><RotateCcw size={17} /> {requestAction.label}</Button></div> : null}
      {paymentCapabilities?.enabled && paymentCapabilities.isTest && refund?.canSimulate && refund.isTest ? (
        <div className="reservation-checkout-test">
          <strong>Test nəticəsi</strong>
          <div className="reservation-refund-actions">
            <Button disabled={isSubmitting} onClick={() => void simulate('Succeeded')}>Uğurlu</Button>
            <Button disabled={isSubmitting} onClick={() => void simulate('Failed')} variant="secondary">Uğursuz</Button>
            <Button disabled={isSubmitting} onClick={() => void simulate('Pending')} variant="secondary"><RefreshCw size={17} /> Gözləmədə</Button>
          </div>
        </div>
      ) : null}
      {refund ? <RefundHistory items={refund.history || []} /> : null}
      {actionError && !isRequestOpen ? <StatusMessage tone="danger" autoHideMs={false}>{actionError}</StatusMessage> : null}
      <ReservationReasonDialog
        isOpen={isRequestOpen}
        title={requestAction?.label || ''}
        description="Sorğunun uyğunluğu serverdə yoxlanılacaq. Geri ödəniş yalnız provayder təsdiqindən sonra tamamlanmış sayılır."
        confirmLabel={requestAction?.label || ''}
        isSubmitting={isSubmitting}
        error={actionError}
        onClose={() => { if (!isSubmitting) setIsRequestOpen(false) }}
        onConfirm={() => { void requestRefund() }}
      />
    </section>
  )
}
