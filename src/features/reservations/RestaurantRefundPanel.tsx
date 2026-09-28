import { Eye, FileCheck2, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { WorkflowAction } from '../../entities/types'
import { ecafeApi, type ReservationRefundResponse, type RestaurantRefundPayoutDetailsResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { ReservationReasonDialog } from './ReservationReasonDialog'
import { RefundHistory } from './RefundHistory'
import { openRefundProof } from './openRefundProof'

type Props = {
  reservationId: string
  restaurantId: string
}

const maxProofSize = 10 * 1024 * 1024

export function RestaurantRefundPanel({ reservationId, restaurantId }: Props) {
  const [reloadKey, setReloadKey] = useState(0)
  const [payoutDetails, setPayoutDetails] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [transferReference, setTransferReference] = useState('')
  const [confirmAction, setConfirmAction] = useState<WorkflowAction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { data: refund, error, isLoading } = useAsyncData<ReservationRefundResponse | null>(
    () => ecafeApi.reservations.getRefundForRestaurant(restaurantId, reservationId),
    null,
    [restaurantId, reservationId, reloadKey],
  )
  const { data: actions, isLoading: areActionsLoading } = useAsyncData<WorkflowAction[]>(
    () => refund
      ? ecafeApi.workflow.actions({
          flowCode: refund.workflowFlowCode,
          statusId: refund.statusId,
          restaurantId,
          entityId: String(refund.id),
        })
      : Promise.resolve([]),
    [],
    [refund?.id, refund?.statusId, restaurantId, reloadKey],
  )

  useEffect(() => {
    if (!payoutDetails) return
    const timeout = window.setTimeout(() => setPayoutDetails(''), 60_000)
    return () => window.clearTimeout(timeout)
  }, [payoutDetails])

  if (isLoading || error || !refund) {
    return error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null
  }

  const availableActions = areActionsLoading ? [] : actions
  const viewAction = availableActions.find((action) => action.code === 'viewPayoutDetails')
  const transferAction = availableActions.find((action) => action.code === 'submitTransfer')

  async function viewPayoutDetails() {
    if (!viewAction) return
    setErrorMessage('')
    setIsLoadingDetails(true)
    try {
      const result = await ecafeApi.workflow.executeAction<RestaurantRefundPayoutDetailsResponse>({ action: viewAction })
      setPayoutDetails(result.data.details)
    } catch (err) {
      setErrorMessage(normalizeCaughtApiError(err, 'Geri ödəniş rekviziti açıla bilmədi.').message)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  async function viewProof(url: string) {
    setErrorMessage('')
    try {
      await openRefundProof(url)
    } catch (err) {
      setErrorMessage(normalizeCaughtApiError(err, 'Geri ödəniş çeki açıla bilmədi.').message)
    }
  }

  async function submitTransfer(action: WorkflowAction) {
    if (!proofFile) {
      setErrorMessage('Əvvəlcə geri ödəniş çekini seçin.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('ProofFile', proofFile)
      if (transferReference.trim()) formData.set('TransferReference', transferReference.trim())
      await ecafeApi.workflow.executeMultipartAction({ action, formData })
      setProofFile(null)
      setTransferReference('')
      setPayoutDetails('')
      setConfirmAction(null)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setErrorMessage(normalizeCaughtApiError(err, 'Geri ödəniş çeki göndərilmədi.').message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function requestTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!transferAction || !proofFile || isSubmitting) return
    if (transferAction.requiresConfirmation) {
      setConfirmAction(transferAction)
    } else {
      void submitTransfer(transferAction)
    }
  }

  return (
    <section className="reservation-refund-panel reservation-manager-refund" aria-label="Geri ödəniş">
      <div className="reservation-refund-heading">
        <div>
          <span className="section-eyebrow">GERİ ÖDƏNİŞ</span>
          <h2>Geri ödəniş</h2>
        </div>
        <strong>{refund.amount.toFixed(2)} {refund.currencyCode}</strong>
      </div>
      <p className="reservation-refund-status">{refund.status}</p>
      {refund.eligibilityReason ? <p className="reservation-refund-meta">{refund.eligibilityReason}</p> : null}
      {refund.payoutDetails ? (
        <div className="reservation-refund-payout">
          <div>
            <strong>Geri ödəniş rekviziti</strong>
            <p>{payoutDetails || refund.payoutDetails.maskedDetails}</p>
          </div>
          {viewAction ? (
            <Button disabled={isLoadingDetails} onClick={() => void (payoutDetails ? setPayoutDetails('') : viewPayoutDetails())} type="button" variant="secondary">
              {payoutDetails ? <ShieldCheck size={17} /> : <Eye size={17} />}
              {payoutDetails ? 'Gizlət' : viewAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
      {transferAction ? (
        <form className="reservation-refund-form" onSubmit={requestTransfer}>
          <label className="reservation-proof-file-field">
            <span>Geri ödəniş çeki</span>
            <input
              accept="application/pdf,image/jpeg,image/png,image/webp,image/avif"
              disabled={isSubmitting}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setErrorMessage(file && file.size > maxProofSize ? 'Fayl maksimum 10 MB ola bilər.' : '')
                setProofFile(file && file.size <= maxProofSize ? file : null)
              }}
              type="file"
            />
            <strong>{proofFile?.name || 'Şəkil və ya PDF seçin'}</strong>
            <small>PDF, JPG, PNG, WEBP və ya AVIF. Maksimum 10 MB.</small>
          </label>
          <TextField
            disabled={isSubmitting}
            label="Köçürmə referansı (istəyə görə)"
            maxLength={100}
            onChange={(event) => setTransferReference(event.target.value)}
            value={transferReference}
          />
          <Button disabled={!proofFile || isSubmitting} type="submit">
            <Send size={17} /> {isSubmitting ? 'Göndərilir...' : transferAction.label}
          </Button>
        </form>
      ) : null}
      {refund.latestTransfer ? (
        <div className="reservation-refund-transfer">
          <div>
            <strong>Son köçürmə çeki</strong>
            <small>{formatReservationDateTime(refund.latestTransfer.submittedAt)}</small>
          </div>
          <Button onClick={() => void viewProof(refund.latestTransfer!.proofFileViewUrl)} type="button" variant="secondary">
            <FileCheck2 size={17} /> Çekə bax
          </Button>
        </div>
      ) : null}
      {refund.latestTransfer?.disputeReason ? (
        <p className="reservation-refund-meta">Müştərinin etirazı: {refund.latestTransfer.disputeReason}</p>
      ) : null}
      {(refund.transferAttempts?.length || 0) > 1 ? (
        <details className="reservation-refund-attempts">
          <summary>Əvvəlki köçürmələr ({refund.transferAttempts.length - 1})</summary>
          {refund.transferAttempts.slice(1).map((attempt) => (
            <div className="reservation-refund-transfer" key={attempt.id}>
              <span>{formatReservationDateTime(attempt.submittedAt)} · {attempt.disputeReason || 'Çek göndərilib'}</span>
              <Button onClick={() => void viewProof(attempt.proofFileViewUrl)} type="button" variant="secondary">
                <Eye size={17} /> Çekə bax
              </Button>
            </div>
          ))}
        </details>
      ) : null}
      <RefundHistory items={refund.history || []} />
      {errorMessage ? <StatusMessage autoHideMs={false} tone="danger">{errorMessage}</StatusMessage> : null}
      <ReservationReasonDialog
        confirmLabel={confirmAction?.label || ''}
        description="Çek müştəriyə göndəriləcək və onun təsdiqi gözləniləcək."
        error={errorMessage}
        isOpen={Boolean(confirmAction)}
        isSubmitting={isSubmitting}
        onClose={() => { if (!isSubmitting) setConfirmAction(null) }}
        onConfirm={() => { if (confirmAction) void submitTransfer(confirmAction) }}
        title="Geri ödəniş çekini göndərirsiniz?"
        confirmVariant="primary"
      />
    </section>
  )
}
