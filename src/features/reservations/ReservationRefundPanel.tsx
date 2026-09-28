import { Check, Eye, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { WorkflowAction } from '../../entities/types'
import { ecafeApi, type ReservationRefundResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { ReservationReasonDialog } from './ReservationReasonDialog'

type Props = {
  reservationId: number
  restaurantId: number
}

export function ReservationRefundPanel({ reservationId, restaurantId }: Props) {
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpeningProof, setIsOpeningProof] = useState(false)
  const [actionError, setActionError] = useState('')
  const { data: refund, error, isLoading } = useAsyncData<ReservationRefundResponse | null>(
    () => ecafeApi.reservations.getRefund(String(reservationId)),
    null,
    [reservationId, reloadKey],
  )
  const { data: actions } = useAsyncData<WorkflowAction[]>(
    () => refund
      ? ecafeApi.workflow.actions({
          flowCode: refund.workflowFlowCode,
          statusId: refund.statusId,
          restaurantId: String(restaurantId),
          entityId: String(refund.id),
        })
      : Promise.resolve([]),
    [],
    [refund?.id, refund?.statusId, restaurantId, reloadKey],
  )

  if (isLoading || error || !refund) {
    return error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null
  }

  const transfer = refund.latestTransfer
  const reviewActions = transfer ? actions.filter((action) =>
    action.code === 'confirmTransfer' || action.code === 'disputeTransfer') : []

  async function openProof(url: string) {
    setActionError('')
    const preview = window.open('', '_blank')
    if (!preview) {
      setActionError('Çekə baxmaq üçün brauzerdə yeni pəncərəyə icazə verin.')
      return
    }

    preview.document.title = 'Geri ödəniş çeki yüklənir...'
    setIsOpeningProof(true)
    try {
      const blob = await ecafeApi.files.viewBlob(url)
      const objectUrl = URL.createObjectURL(blob)
      preview.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (err) {
      preview.close()
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

  return (
    <section className="reservation-refund-panel" aria-label="Geri ödəniş">
      <div className="reservation-refund-heading">
        <div>
          <span className="section-eyebrow">GERİ ÖDƏNİŞ</span>
          <h2>Geri ödəniş</h2>
        </div>
        <strong>{refund.amount.toFixed(2)} {refund.currencyCode}</strong>
      </div>
      <p className="reservation-refund-status">{refund.status}</p>
      {refund.payoutDetails ? <p className="reservation-refund-meta">Hesab: {refund.payoutDetails.maskedDetails}</p> : null}
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
      {actionError && !pendingAction ? <StatusMessage tone="danger" autoHideMs={false}>{actionError}</StatusMessage> : null}
      <ReservationReasonDialog
        isOpen={Boolean(pendingAction)}
        title={pendingAction?.label || ''}
        description={pendingAction?.code === 'disputeTransfer'
          ? 'Köçürmə hesabınıza çatmayıbsa və ya məbləğ düzgün deyilsə, səbəbi yazın.'
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
          if (pendingAction) void reviewTransfer(pendingAction, reason)
        }}
      />
    </section>
  )
}
