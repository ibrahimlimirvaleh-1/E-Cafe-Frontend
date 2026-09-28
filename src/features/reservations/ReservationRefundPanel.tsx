import { Check, Eye, RotateCcw, Send } from 'lucide-react'
import { useState } from 'react'
import type { WorkflowAction } from '../../entities/types'
import { ecafeApi, type ReservationRefundResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button } from '../../shared/ui/Button'
import { TextareaField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { ReservationReasonDialog } from './ReservationReasonDialog'
import { openRefundProof } from './openRefundProof'
import { RefundHistory } from './RefundHistory'

type Props = {
  reservationId: number
  restaurantId: number
  reservationStatusId: number
  reservationFlowCode: string
}

export function ReservationRefundPanel({ reservationId, restaurantId, reservationStatusId, reservationFlowCode }: Props) {
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpeningProof, setIsOpeningProof] = useState(false)
  const [actionError, setActionError] = useState('')
  const [payoutDetails, setPayoutDetails] = useState('')
  const { data: refund, error, isLoading } = useAsyncData<ReservationRefundResponse | null>(
    () => ecafeApi.reservations.getRefund(String(reservationId)),
    null,
    [reservationId, reloadKey],
  )
  const { data: actions, isLoading: areActionsLoading } = useAsyncData<WorkflowAction[]>(
    () => !isLoading
      ? ecafeApi.workflow.actions({
          flowCode: refund?.workflowFlowCode || reservationFlowCode,
          statusId: refund?.statusId || reservationStatusId,
          restaurantId: String(restaurantId),
          entityId: String(refund?.id || reservationId),
        })
      : Promise.resolve([]),
    [],
    [refund?.id, refund?.statusId, restaurantId, reservationId, reservationStatusId, reservationFlowCode, isLoading, reloadKey],
  )

  if (isLoading || error) {
    return error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null
  }

  const transfer = refund?.latestTransfer
  const availableActions = areActionsLoading ? [] : actions
  const requestAction = !refund ? availableActions.find((action) => action.code === 'requestRefund') : null
  const payoutAction = refund ? availableActions.find((action) => action.code === 'submitPayoutDetails') : null
  const reviewActions = transfer ? availableActions.filter((action) =>
    action.code === 'confirmTransfer' || action.code === 'disputeTransfer') : []

  async function openProof(url: string) {
    setActionError('')
    setIsOpeningProof(true)
    try {
      await openRefundProof(url)
    } catch (err) {
      setActionError(normalizeCaughtApiError(err, 'Geri ödəniş çeki açıla bilmədi.').message)
    } finally {
      setIsOpeningProof(false)
    }
  }

  async function reviewTransfer(action: WorkflowAction, reason: string) {
    if (!transfer) return
    setActionError('')
    setIsSubmitting(true)
    try {
      await ecafeApi.workflow.executeAction({
        action,
        body: { transferId: transfer.id, ...(action.requiresReason ? { reason } : {}) },
      })
      setPendingAction(null)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setActionError(normalizeCaughtApiError(err, 'Geri ödəniş əməliyyatı tamamlanmadı.').message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitPayoutDetails(action: WorkflowAction) {
    const details = payoutDetails.trim()
    if (details.length < 4) {
      setActionError('Geri ödəniş rekviziti ən azı 4 simvol olmalıdır.')
      return
    }

    setActionError('')
    setIsSubmitting(true)
    try {
      await ecafeApi.workflow.executeAction({ action, body: { details } })
      setPayoutDetails('')
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setActionError(normalizeCaughtApiError(err, 'Geri ödəniş rekviziti göndərilmədi.').message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function requestRefund(action: WorkflowAction) {
    setActionError('')
    setIsSubmitting(true)
    try {
      await ecafeApi.workflow.executeAction({ action })
      setPendingAction(null)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setActionError(normalizeCaughtApiError(err, 'Geri ödəniş sorğusu göndərilmədi.').message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!refund && !requestAction) return null

  return (
    <section className="reservation-refund-panel" aria-label="Geri ödəniş">
      <div className="reservation-refund-heading">
        <div>
          <span className="section-eyebrow">GERİ ÖDƏNİŞ</span>
          <h2>Geri ödəniş</h2>
        </div>
        {refund ? <strong>{refund.amount.toFixed(2)} {refund.currencyCode}</strong> : null}
      </div>
      {refund ? <p className="reservation-refund-status">{refund.status}</p> : null}
      {refund?.eligibilityReason ? <p className="reservation-refund-meta">{refund.eligibilityReason}</p> : null}
      {refund?.payoutDetails ? <p className="reservation-refund-meta">Hesab: {refund.payoutDetails.maskedDetails}</p> : null}
      {requestAction ? (
        <div className="reservation-refund-actions">
          <Button disabled={isSubmitting} onClick={() => setPendingAction(requestAction)}>
            <RotateCcw size={17} /> {requestAction.label}
          </Button>
        </div>
      ) : null}
      {payoutAction ? (
        <form className="reservation-refund-form" onSubmit={(event) => {
          event.preventDefault()
          void submitPayoutDetails(payoutAction)
        }}>
          <TextareaField
            label="Geri ödəniş rekviziti"
            hint="IBAN və ya köçürmə üçün tələb olunan məlumatı yazın. CVV və PIN göndərməyin."
            maxLength={1000}
            rows={3}
            value={payoutDetails}
            onChange={(event) => setPayoutDetails(event.target.value)}
            disabled={isSubmitting}
          />
          <Button disabled={isSubmitting || payoutDetails.trim().length < 4} type="submit">
            <Send size={17} /> {isSubmitting ? 'Göndərilir...' : payoutAction.label}
          </Button>
        </form>
      ) : null}
      {transfer ? (
        <div className="reservation-refund-transfer">
          <div>
            <strong>Son göndərilən köçürmə</strong>
            <small>{formatReservationDateTime(transfer.submittedAt)}</small>
          </div>
          <Button disabled={isOpeningProof} onClick={() => void openProof(transfer.proofFileViewUrl)} variant="secondary">
            <Eye size={17} /> Çekə bax
          </Button>
        </div>
      ) : null}
      {transfer?.disputeReason ? <p className="reservation-refund-meta">Etiraz səbəbi: {transfer.disputeReason}</p> : null}
      {reviewActions.length > 0 ? (
        <div className="reservation-refund-actions">
          {reviewActions.map((action) => (
            <Button
              disabled={isSubmitting}
              key={action.code}
              onClick={() => {
                setActionError('')
                setPendingAction(action)
              }}
              variant={action.code === 'disputeTransfer' ? 'secondary' : 'primary'}
            >
              {action.code === 'disputeTransfer' ? <RotateCcw size={17} /> : <Check size={17} />}
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      {refund && (refund.transferAttempts?.length || 0) > 1 ? (
        <details className="reservation-refund-attempts">
          <summary>Əvvəlki köçürmələr ({refund.transferAttempts.length - 1})</summary>
          {refund.transferAttempts.slice(1).map((attempt) => (
            <div className="reservation-refund-transfer" key={attempt.id}>
              <span>{formatReservationDateTime(attempt.submittedAt)} · {attempt.disputeReason || 'Çek göndərilib'}</span>
              <Button onClick={() => void openProof(attempt.proofFileViewUrl)} type="button" variant="secondary">
                <Eye size={17} /> Çekə bax
              </Button>
            </div>
          ))}
        </details>
      ) : null}
      {refund ? <RefundHistory items={refund.history || []} /> : null}
      {actionError && !pendingAction ? <StatusMessage tone="danger" autoHideMs={false}>{actionError}</StatusMessage> : null}
      <ReservationReasonDialog
        isOpen={Boolean(pendingAction)}
        title={pendingAction?.label || ''}
        description={pendingAction?.code === 'disputeTransfer'
          ? 'Köçürmə hesabınıza çatmayıbsa və ya məbləğ düzgün deyilsə, səbəbi yazın.'
          : pendingAction?.code === 'requestRefund'
            ? 'Geri ödəniş hüququ backend qaydasına əsasən yoxlanacaq.'
            : 'Məbləğin hesabınıza çatdığını yoxladıqdan sonra təsdiqləyin.'}
        confirmLabel={pendingAction?.label || ''}
        confirmVariant={pendingAction?.code === 'disputeTransfer' ? 'danger' : 'primary'}
        requireReason={pendingAction?.requiresReason}
        isSubmitting={isSubmitting}
        error={actionError}
        onClose={() => {
          if (!isSubmitting) setPendingAction(null)
        }}
        onConfirm={(reason) => {
          if (!pendingAction) return
          if (pendingAction.code === 'requestRefund') {
            void requestRefund(pendingAction)
          } else {
            void reviewTransfer(pendingAction, reason)
          }
        }}
      />
    </section>
  )
}
