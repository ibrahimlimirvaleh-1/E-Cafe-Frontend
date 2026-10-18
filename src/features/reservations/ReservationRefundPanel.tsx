import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { WorkflowAction } from '../../entities/types'
import { ecafeApi, type PaymentCapabilities, type ReservationRefundRequestInfo, type ReservationRefundResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { refundStatusId } from '../../shared/lib/paymentStatus'
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
  refundRequestIsUpdating?: boolean
}

export function ReservationRefundPanel({ reservationId, restaurantId, reservationStatusId, reservationFlowCode, refundRequest, refundRequestIsUpdating = false }: Props) {
  const { i18n: translation } = useTranslation()
  const { user } = useAuth()
  const scope = `${user?.userId || ''}:${restaurantId}:${reservationId}`
  const localizedScope = `${scope}:${translation.resolvedLanguage || translation.language}`
  const scopeRef = useRef(scope)
  const loadedRefundScopeRef = useRef('')
  scopeRef.current = scope
  const [reloadKey, setReloadKey] = useState(0)
  const [isRequestOpen, setIsRequestOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  useEffect(() => {
    setIsRequestOpen(false)
    setIsSubmitting(false)
    setActionError('')
  }, [scope])
  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])
  const { data: refund, error, hasData, isLoading } = useKeyedAsyncData<ReservationRefundResponse | null>(
    () => ecafeApi.reservations.getRefund(String(reservationId)),
    null,
    localizedScope,
    [reloadKey],
  )
  useEffect(() => {
    if (refund) loadedRefundScopeRef.current = scope
  }, [refund, scope])
  const { data: paymentCapabilities } = useKeyedAsyncData<PaymentCapabilities | null>(
    () => ecafeApi.reservationPayments.capabilities(),
    null,
    scope,
    [scope],
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
    `${localizedScope}:${refund?.id || ''}:${reservationStatusId}:${reservationFlowCode}`,
    [reservationStatusId, reservationFlowCode, refund?.id, isLoading, reloadKey],
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

  async function refreshRefund() {
    if (!paymentCapabilities?.enabled || !refund || refund.statusId !== refundStatusId.processing ||
      refund.sourcePaymentId == null || refund.requiresManualReview || isSubmitting) return
    const requestedScope = scope
    setActionError('')
    setIsSubmitting(true)
    try {
      await ecafeApi.reservationPayments.refreshRefund(refund.id)
      if (scopeRef.current !== requestedScope) return
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (cause) {
      if (scopeRef.current !== requestedScope) return
      setActionError(normalizeCaughtApiError(cause, 'Geri ödənişin vəziyyəti yoxlanılmadı.').message)
    } finally {
      if (scopeRef.current === requestedScope) setIsSubmitting(false)
    }
  }

  if (!hasData && !error && (loadedRefundScopeRef.current === scope || refundRequestIsUpdating)) {
    return <section className="reservation-refund-panel" id="refund" aria-busy="true">
      <div className="reservation-refund-heading"><div><span className="section-eyebrow">{i18n.t('ui.features.reservations.reservation_refund_panel.geri_odenis_b6e067')}</span><h2>{i18n.t('ui.features.reservations.reservation_refund_panel.geri_odenis_a962bb')}</h2></div></div>
      <p className="reservation-refund-meta">{i18n.t('ui.features.reservations.reservation_refund_panel.yoxlanilir_b497d3')}</p>
    </section>
  }
  if (isLoading || (error && !hasData)) {
    return error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null
  }
  if (!refund && !requestAction && !refundRequest && !refundRequestIsUpdating) return null

  return (
    <section className="reservation-refund-panel" id="refund" aria-label={i18n.t('ui.features.reservations.reservation_refund_panel.geri_odenis_a962bb')}>
      {error ? <StatusMessage tone="warning" autoHideMs={false}>{error}</StatusMessage> : null}
      <div className="reservation-refund-heading">
        <div><span className="section-eyebrow">{i18n.t('ui.features.reservations.reservation_refund_panel.geri_odenis_b6e067')}</span><h2>{i18n.t('ui.features.reservations.reservation_refund_panel.geri_odenis_a962bb')}</h2></div>
        {refund || refundRequest ? <strong>{(refund?.amount ?? refundRequest!.amount).toFixed(2)} {refund?.currencyCode ?? refundRequest!.currencyCode}</strong> : null}
      </div>
      {!refund && refundRequest ? <StatusMessage tone="info" autoHideMs={false} dismissible={false}>{refundRequest.message}</StatusMessage> : null}
      {refundRequestIsUpdating && !refund ? <p className="reservation-refund-meta" aria-busy="true">{i18n.t('ui.features.reservations.reservation_refund_panel.yoxlanilir_b497d3')}</p> : null}
      {refund ? <p className="reservation-refund-status" role="status">{refund.statusLabel || refund.status}</p> : null}
      {refund?.requiresManualReview ? (
        <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.features.reservations.reservation_refund_panel.bu_kohne_odenis_provaydere_bagli_deyil_bcb03a')}</StatusMessage>
      ) : refund?.customerNextStep ? <p className="reservation-refund-meta">{refund.customerNextStep}</p> : null}
      {refund?.eligibilityReason ? <p className="reservation-refund-meta">{refund.eligibilityReason}</p> : null}
      {refund?.isTest ? <StatusMessage tone="info" autoHideMs={false}>{i18n.t('ui.features.reservations.reservation_refund_panel.test_geri_odenisi_real_pul_kocurulmur_5be270')}</StatusMessage> : null}
      {requestAction ? <div className="reservation-refund-actions"><Button disabled={isSubmitting} onClick={() => setIsRequestOpen(true)}><RotateCcw size={17} /> {requestAction.label}</Button></div> : null}
      {paymentCapabilities?.enabled && refund?.statusId === refundStatusId.processing &&
        refund.sourcePaymentId != null && !refund.requiresManualReview ? (
          <div className="reservation-refund-actions">
            <Button disabled={isSubmitting} onClick={() => void refreshRefund()} variant="secondary">
              <RefreshCw size={17} /> {isSubmitting ?i18n.t('ui.features.reservations.reservation_refund_panel.yoxlanilir_b497d3') :i18n.t('ui.features.reservations.reservation_refund_panel.veziyyeti_yoxla_d1c8c4')}
            </Button>
          </div>
        ) : null}
      {paymentCapabilities?.enabled && paymentCapabilities.isTest && refund?.canSimulate && refund.isTest ? (
        <div className="reservation-checkout-test">
          <strong>{i18n.t('ui.features.reservations.reservation_refund_panel.test_neticesi_8a11a1')}</strong>
          <div className="reservation-refund-actions">
            <Button disabled={isSubmitting} onClick={() => void simulate('Succeeded')}>{i18n.t('ui.features.reservations.reservation_refund_panel.ugurlu_500ad6')}</Button>
            <Button disabled={isSubmitting} onClick={() => void simulate('Failed')} variant="secondary">{i18n.t('ui.features.reservations.reservation_refund_panel.ugursuz_a71e84')}</Button>
            <Button disabled={isSubmitting} onClick={() => void simulate('Pending')} variant="secondary"><RefreshCw size={17} /> {i18n.t('ui.features.reservations.reservation_refund_panel.gozlemede_df8d76')}</Button>
          </div>
        </div>
      ) : null}
      {refund ? <RefundHistory items={refund.history || []} /> : null}
      {actionError && !isRequestOpen ? <StatusMessage tone="danger" autoHideMs={false}>{actionError}</StatusMessage> : null}
      <ReservationReasonDialog
        isOpen={isRequestOpen}
        title={requestAction?.label || ''}
        description={i18n.t('ui.features.reservations.reservation_refund_panel.sorgunun_uygunlugu_serverde_yoxlanilac_0aa301')}
        confirmLabel={requestAction?.label || ''}
        isSubmitting={isSubmitting}
        error={actionError}
        onClose={() => { if (!isSubmitting) setIsRequestOpen(false) }}
        onConfirm={() => { void requestRefund() }}
      />
    </section>
  )
}
