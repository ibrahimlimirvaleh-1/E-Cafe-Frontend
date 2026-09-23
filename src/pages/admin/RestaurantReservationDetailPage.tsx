import { Ban, CalendarDays, CheckCircle2, Clock3, Eye, Users } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ReservationPaymentInstructionPanel } from '../../features/reservations/ReservationPaymentInstructionPanel'
import { ReservationHistoryTimeline } from '../../features/reservations/ReservationHistoryTimeline'
import { ReservationReasonDialog } from '../../features/reservations/ReservationReasonDialog'
import type { ReservationHistoryResponse, ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import type { WorkflowAction } from '../../entities/types'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'

export function RestaurantReservationDetailPage() {
  const { user } = useAuth()
  const { reservationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurantId') || user?.restaurantId || user?.profiles[0]?.restaurantId || ''
  const [reloadKey, setReloadKey] = useState(0)
  const [actionName, setActionName] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null)
  const { data: reservation, error, isLoading } = useAsyncData<ReservationResponse | null>(
    () => restaurantId && reservationId ? ecafeApi.reservations.getForRestaurant(restaurantId, reservationId) : Promise.resolve(null),
    null,
    [restaurantId, reservationId, reloadKey],
  )
  const { data: workflowActions } = useAsyncData<WorkflowAction[]>(
    () => reservation && restaurantId && reservationId && reservation.workflowFlowCode
      ? ecafeApi.workflow.actions({
          flowCode: reservation.workflowFlowCode,
          statusId: reservation.statusId,
          restaurantId,
          entityId: reservationId,
        })
      : Promise.resolve([]),
    [],
    [restaurantId, reservationId, reservation?.workflowFlowCode, reservation?.statusId],
  )
  const { data: history } = useAsyncData<ReservationHistoryResponse | null>(
    () => restaurantId && reservationId
      ? ecafeApi.reservations.getHistoryForRestaurant(restaurantId, reservationId)
      : Promise.resolve(null),
    null,
    [restaurantId, reservationId, reloadKey],
  )
  const sendPaymentInstructionAction = workflowActions.find((action) => action.code === 'sendPaymentInstruction')
  const visibleActions = workflowActions.filter((action) => action.code !== 'sendPaymentInstruction' && action.code !== 'submitPaymentProof')

  async function runAction(action: WorkflowAction, body?: unknown, onSuccess?: () => void) {
    setActionError('')
    setActionName(action.code)

    try {
      await ecafeApi.workflow.executeAction({ action, body })
      onSuccess?.()
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      setReloadKey((value) => value + 1)
    } catch (err) {
      setActionError(normalizeCaughtApiError(err, 'Əməliyyat icra olunmadı.').message)
    } finally {
      setActionName('')
    }
  }

  function requestAction(action: WorkflowAction) {
    setActionError('')
    if (action.requiresConfirmation) {
      setPendingAction(action)
      return
    }

    void runAction(action)
  }

  async function openPaymentProof() {
    const proofUrl = reservation?.latestPaymentProof?.fileViewUrl
    if (!proofUrl) {
      return
    }

    const previewWindow = window.open('', '_blank')
    if (!previewWindow) {
      setActionError('Çekə baxmaq üçün brauzer pəncərəsinə icazə verin.')
      return
    }

    previewWindow.document.title = 'Ödəniş çeki yüklənir...'
    try {
      const blob = await ecafeApi.files.viewBlob(proofUrl)
      const objectUrl = URL.createObjectURL(blob)
      previewWindow.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (err) {
      previewWindow.close()
      setActionError(normalizeCaughtApiError(err, 'Ödəniş çeki açıla bilmədi.').message)
    }
  }

  if (isLoading) return <main className="admin-page narrow"><p className="online-only">Rezervasiya yüklənir...</p></main>
  if (error || !reservation) {
    return <main className="admin-page narrow"><StatusMessage tone="danger" autoHideMs={false}>{error || 'Rezervasiya tapılmadı.'}</StatusMessage></main>
  }

  const presentation = getReservationStatusPresentation(reservation.status)

  return (
    <main className="admin-page narrow reservation-detail-page">
      <PageHeader eyebrow="Rezervasiya detalı" title={`Rezervasiya #${reservation.id}`} description={reservation.customerName || 'Müştəri rezervasiyası'} />
      <section className="reservation-detail-card">
        <div className="reservation-detail-card-header">
          <div>
            <span className="reservation-card-kicker">{reservation.restaurantName || 'Restoran'}</span>
            <h2>{reservation.tableName || `Masa ${reservation.tableId}`}</h2>
          </div>
          <Badge tone={presentation.tone}>{presentation.label}</Badge>
        </div>
        <div className="reservation-detail-grid">
          <div><CalendarDays size={17} /><span><small>Gəliş vaxtı</small><strong>{formatReservationDateTime(reservation.reservedAt)}</strong></span></div>
          <div><Users size={17} /><span><small>Qonaq sayı</small><strong>{reservation.peopleCount} nəfər</strong></span></div>
          <div><Clock3 size={17} /><span><small>Depozit</small><strong>{reservation.depositAmount.toFixed(2)} AZN</strong></span></div>
          <div><Clock3 size={17} /><span><small>{reservation.holdExpiresAt ? 'Ödəniş üçün son vaxt' : 'Cavab üçün son vaxt'}</small><strong>{formatReservationDateTime(reservation.holdExpiresAt || reservation.restaurantResponseExpiresAt)}</strong></span></div>
        </div>
        {reservation.latestPaymentInstruction ? (
          <div className="reservation-payment-note">
            <strong>Son göndərilən ödəniş məlumatı</strong>
            <p>{reservation.latestPaymentInstruction.displayText}</p>
            <small>{formatReservationDateTime(reservation.latestPaymentInstruction.sentAt)}</small>
          </div>
        ) : null}
        {reservation.latestPaymentProof ? (
          <div className="reservation-payment-proof-note">
            <div>
              <strong>Son ödəniş çeki</strong>
              <p>{formatReservationDateTime(reservation.latestPaymentProof.submittedAt)} · {reservation.latestPaymentProof.amount.toFixed(2)} AZN</p>
            </div>
            <Button onClick={() => void openPaymentProof()} type="button" variant="secondary">
              <Eye size={17} />
              Çekə bax
            </Button>
          </div>
        ) : null}
        {(visibleActions.length > 0 || actionError) ? (
          <div className="reservation-detail-actions">
            <div>
              <span className="section-eyebrow">NÖVBƏTİ ADDIM</span>
              <strong>Rezervasiya əməliyyatı</strong>
            </div>
            <div className="action-row">
              {visibleActions.map((action) => (
                <Button
                  disabled={Boolean(actionName)}
                  key={`${action.code}-${action.endpoint}`}
                  onClick={() => requestAction(action)}
                  variant={action.requiresConfirmation ? 'danger' : 'primary'}
                >
                  {action.requiresConfirmation ? <Ban size={17} /> : <CheckCircle2 size={17} />}
                  {actionName === action.code ? 'İcra olunur...' : action.label}
                </Button>
              ))}
            </div>
            {actionError ? <StatusMessage tone="danger">{actionError}</StatusMessage> : null}
          </div>
        ) : null}
        <div className="action-row">
          <ButtonLink variant="secondary" to={`/admin/reservations?restaurantId=${restaurantId}`}>Siyahıya qayıt</ButtonLink>
        </div>
      </section>
      <ReservationHistoryTimeline items={history?.items || []} />
      {sendPaymentInstructionAction ? (
        <ReservationPaymentInstructionPanel
          action={sendPaymentInstructionAction}
          restaurantId={restaurantId}
          reservationId={String(reservation.id)}
          amount={`${reservation.depositAmount.toFixed(2)} AZN`}
        />
      ) : null}
      <ReservationReasonDialog
        confirmLabel={pendingAction?.label || 'Təsdiqlə'}
        description="Bu əməliyyat rezervasiyanın backend workflow qaydasına uyğun icra ediləcək."
        error={pendingAction ? actionError : ''}
        isOpen={Boolean(pendingAction)}
        isSubmitting={Boolean(pendingAction && actionName === pendingAction.code)}
        onClose={() => setPendingAction(null)}
        onConfirm={(reason) => {
          if (!pendingAction) return
          void runAction(pendingAction, reason ? { reason } : undefined, () => setPendingAction(null))
        }}
        requireReason={pendingAction?.requiresReason || false}
        title={`${pendingAction?.label || 'Əməliyyatı'} təsdiqləyirsiniz?`}
      />
    </main>
  )
}
