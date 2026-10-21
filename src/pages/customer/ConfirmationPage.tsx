import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { Ban, CalendarDays, CheckCircle2, CircleAlert, Clock3, ReceiptText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReservationReasonDialog } from '../../features/reservations/ReservationReasonDialog'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import type { WorkflowAction } from '../../entities/types'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationDepartureReasonLabel, isReservationConfirmed } from '../../shared/lib/reservationStatus'
import { CustomerDepositCheckoutPanel } from '../../features/reservations/CustomerDepositCheckoutPanel'
import { ReservationHistoryTimeline } from '../../features/reservations/ReservationHistoryTimeline'
import { ReservationRefundPanel } from '../../features/reservations/ReservationRefundPanel'
import { ReservationLateArrivalPanel } from '../../features/reservations/ReservationLateArrivalPanel'
import { ReservationWaitingSummary } from '../../features/reservations/ReservationWaitingSummary'
import type { ReservationHistoryResponse, ReservationResponse } from '../../shared/api/ecafeApi'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'
import { Badge } from '../../shared/ui/Badge'
import { ScheduleOfferPanel } from '../../features/reservations/ScheduleOfferPanel'

export function ConfirmationPage() {
  const { i18n: translation } = useTranslation()
  const language = translation.resolvedLanguage || translation.language
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const reservationId = searchParams.get('reservationId')
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const onRefresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', onRefresh)
  }, [])
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [cancelNow, setCancelNow] = useState(Date.now())
  useEffect(() => {
    if (!isCancelDialogOpen) return
    setCancelNow(Date.now())
    const timer = window.setInterval(() => setCancelNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isCancelDialogOpen])
  const [showDepositWaiverNotice, setShowDepositWaiverNotice] = useState(false)
  const previousReservationRef = useRef<{ id: number; depositAmount: number } | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const reservationScope = `${user?.userId || ''}:${reservationId || ''}`
  const { data: reservationResult, error, hasData, isLoading } = useKeyedAsyncData<{ data: ReservationResponse; language: string } | null>(
    () => reservationId
      ? ecafeApi.reservations.getById(reservationId).then((data) => ({ data, language }))
      : Promise.resolve(null),
    null,
    reservationScope,
    [user?.userId, reservationId, language, reloadKey],
  )
  const reservation = reservationResult?.data ?? null
  const refundRequestIsUpdating = Boolean(reservation?.refundRequest && reservationResult?.language !== language)
  const isWaiting = Boolean(reservation?.waiting || reservation?.requiresReceptionReview)
  useEffect(() => {
    if (!isWaiting) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setReloadKey((value) => value + 1)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [isWaiting])
  useEffect(() => {
    if (!reservation) return
    const previous = previousReservationRef.current
    if (previous?.id === reservation.id && previous.depositAmount > 0 && reservation.depositAmount === 0) {
      setShowDepositWaiverNotice(true)
    }
    previousReservationRef.current = { id: reservation.id, depositAmount: reservation.depositAmount }
  }, [reservation])
  const actionsScope = `${reservationScope}:${reservation?.workflowFlowCode || ''}:${reservation?.statusId || ''}:${reservation?.restaurantId || ''}`
  const { data: workflowActions } = useKeyedAsyncData<WorkflowAction[]>(
    () => reservation && reservationId && reservation.workflowFlowCode
      ? ecafeApi.workflow.actions({
          flowCode: reservation.workflowFlowCode,
          statusId: reservation.statusId,
          restaurantId: String(reservation.restaurantId),
          entityId: reservationId,
        })
      : Promise.resolve([]),
    [],
    actionsScope,
    [user?.userId, reservationId, reservation?.workflowFlowCode, reservation?.statusId, reservation?.restaurantId, reloadKey],
  )
  const { data: history } = useKeyedAsyncData<ReservationHistoryResponse | null>(
    () => reservationId ? ecafeApi.reservations.getHistory(reservationId) : Promise.resolve(null),
    null,
    reservationScope,
    [user?.userId, reservationId, language, reloadKey],
  )

  const cancelAction = workflowActions.find((action) => action.code === 'cancel')

  async function cancelReservation(reason: string) {
    if (!reservationId || !cancelAction) {
      return
    }

    setCancelError('')
    setIsCancelling(true)
    try {
      await ecafeApi.workflow.executeAction({
        action: cancelAction,
        body: reason ? { reason } : undefined,
      })
      setIsCancelDialogOpen(false)
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (err) {
      setCancelError(normalizeCaughtApiError(err, 'Rezervasiya ləğv edilmədi.').message)
    } finally {
      setIsCancelling(false)
    }
  }

  const reservationPresentation = reservation
    ? getReservationStatusPresentation(reservation.status)
    : null
  const statusTone = reservationPresentation?.tone || 'neutral'
  const StatusIcon = statusTone === 'success'
    ? CheckCircle2
    : statusTone === 'danger'
      ? CircleAlert
      : statusTone === 'warning'
        ? Clock3
        : statusTone === 'info'
          ? ReceiptText
          : CalendarDays

  return (
    <main className="center-page reservation-confirmation-page">
      <div className="reservation-confirmation-layout">
        <article className="success-panel reservation-confirmation-panel">
          <div className={`reservation-confirmation-icon is-${statusTone}`}><StatusIcon size={28} /></div>
          <div className="reservation-confirmation-heading">
            <span className="section-eyebrow">{i18n.t('ui.pages.customer.confirmation_page.rezervasiya_detali_332065')}</span>
            <h1>{reservationId ? `Rezervasiya #${reservationId}` :i18n.t('ui.pages.customer.confirmation_page.sifaris_qeyde_alindi_dbf3c9')}</h1>
            {reservation ? <p>{reservation.restaurantName || 'Restoran rezervasiyası'}</p> : null}
          </div>
          {reservationPresentation ? <Badge tone={reservationPresentation.tone}>{reservationPresentation.label}</Badge> : null}
          <p>
            {reservationId
              ? reservationPresentation?.tone === 'success'
                ?i18n.t('ui.pages.customer.confirmation_page.rezervasiyanin_statusu_yenilendi_detal_c99af8')
                :i18n.t('ui.pages.customer.confirmation_page.rezervasiyanin_statusunu_ve_novbeti_ad_9e40bf')
              :i18n.t('ui.pages.customer.confirmation_page.sifaris_melumatlari_restorana_gonderil_bf3bf6')}
          </p>
          {reservationId && isLoading ? <p className="online-only">{i18n.t('ui.pages.customer.confirmation_page.rezervasiya_detallari_yuklenir_7d166f')}</p> : null}
          {reservationId && error ? <p className="reservation-availability-message danger">{hasData ?i18n.t('ui.pages.customer.confirmation_page.son_melumat_yenilenmedi_yeniden_yoxlan_fec2cf') :i18n.t('ui.pages.customer.confirmation_page.rezervasiya_detallari_yuklenmedi_f02787')}</p> : null}
          {reservation ? (
            <>
              <dl className="reservation-confirmation-details">
                <div><dt>{i18n.t('ui.pages.customer.confirmation_page.tarix_ve_saat_d1a058')}</dt><dd>{formatReservationDateTime(reservation.reservedAt, reservation.timeZone || undefined)}</dd></div>
                <div><dt>{i18n.t('ui.pages.customer.confirmation_page.masa_058c4c')}</dt><dd>{reservation.tableName || `Masa ${reservation.tableId}`}</dd></div>
                <div><dt>{i18n.t('ui.pages.customer.confirmation_page.qonaq_sayi_012aa3')}</dt><dd>{i18n.t('ui.count.guests', { count: reservation.peopleCount })}</dd></div>
                <div><dt>{i18n.t('ui.pages.customer.confirmation_page.status_920e41')}</dt><dd>{getReservationStatusPresentation(reservation.status).label}</dd></div>
                {reservation.departureReason ? <div><dt>{i18n.t('ui.pages.customer.confirmation_page.ayrilma_sebebi_cf5bda')}</dt><dd>{getReservationDepartureReasonLabel(reservation.departureReason)}</dd></div> : null}
                <div><dt>{i18n.t('ui.pages.customer.confirmation_page.depozit_4a14b8')}</dt><dd>{reservation.depositAmount > 0 ? `${reservation.depositAmount.toFixed(2)} AZN` :i18n.t('ui.pages.customer.confirmation_page.teleb_olunmur_46f021')}</dd></div>
                {!reservation.expectedArrivalAt && !reservation.arrivedAt && isReservationConfirmed(reservation.status) ? <div><dt>{i18n.t('ui.pages.customer.confirmation_page.gelis_ucun_son_vaxt_04c872')}</dt><dd>{formatReservationDateTime(reservation.noShowDeadlineAt, reservation.timeZone || undefined)}</dd></div> : null}
                {reservation.mustVacateAt ? <div><dt>{i18n.t('ui.pages.customer.confirmation_page.masani_tehvil_vaxti_4e00d4')}</dt><dd>{formatReservationDateTime(reservation.mustVacateAt, reservation.timeZone || undefined)}</dd></div> : null}
                {reservation.holdExpiresAt ? <div><dt>{i18n.t('ui.pages.customer.confirmation_page.odenis_ucun_son_vaxt_81dc6d')}</dt><dd>{formatReservationDateTime(reservation.holdExpiresAt)}</dd></div> : null}
              </dl>

              <ReservationWaitingSummary waiting={reservation.waiting} requiresReceptionReview={reservation.requiresReceptionReview} timeZone={reservation.timeZone} viewer="customer" />

              <ReservationLateArrivalPanel reservation={reservation} refreshKey={reloadKey} onChanged={() => setReloadKey((value) => value + 1)} />
              <ScheduleOfferPanel reservationId={String(reservation.id)} refreshKey={reloadKey}
                onChanged={() => setReloadKey((value) => value + 1)} />

              {reservation.depositAmount > 0 ? (
                <CustomerDepositCheckoutPanel
                  restaurantId={String(reservation.restaurantId)}
                  reservationId={String(reservation.id)}
                  amount={reservation.depositAmount}
                  onChanged={() => setReloadKey((value) => value + 1)}
                />
              ) : null}
              <ReservationRefundPanel
                reservationId={reservation.id}
                restaurantId={reservation.restaurantId}
                reservationStatusId={reservation.statusId}
                reservationFlowCode={reservation.workflowFlowCode}
                refundRequest={refundRequestIsUpdating ? null : reservation.refundRequest}
                refundRequestIsUpdating={refundRequestIsUpdating}
              />
              {cancelAction ? (
                <div className="reservation-confirmation-actions">
                  <Button
                    onClick={() => {
                      setCancelError('')
                      setIsCancelDialogOpen(true)
                    }}
                    variant="danger"
                  >
                    <Ban size={17} />
                    {cancelAction.label}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </article>

        <aside className="reservation-confirmation-side">
          {reservation ? <ReservationHistoryTimeline items={history?.items || []} arrivedAt={history?.arrivedAt ?? reservation.arrivedAt} seatedAt={history?.seatedAt ?? reservation.seatedAt} requiresReceptionReview={reservation.requiresReceptionReview} timeZone={reservation.timeZone || undefined} /> : null}
          <ButtonLink to={reservation ? `/tracking/${reservation.id}` : '/reservations'}>{i18n.t('ui.pages.customer.confirmation_page.rezervasiyani_izle_829de4')}</ButtonLink>
        </aside>
      </div>
      <ReservationReasonDialog
        confirmLabel={i18n.t('ui.pages.customer.confirmation_page.rezervasiyani_legv_et_e4a3cc')}
        description={reservation?.hasConfirmedDeposit
          ? reservation.canCancelWithRefund && new Date(reservation.refundCancellationDeadlineAt || '').getTime() > cancelNow
            ? `İndi ləğv etsəniz depozitin tam geri ödənişini tələb edə bilərsiniz. Geri ödəniş üçün son ləğv vaxtı: ${formatReservationDateTime(reservation.refundCancellationDeadlineAt)}. Pul ayrıca geri ödəniş prosesi ilə qaytarılır.`
            :i18n.t('ui.pages.customer.confirmation_page.rezervasiya_legv_edilecek_ve_masa_azad_902576')
          :i18n.t('ui.pages.customer.confirmation_page.rezervasiya_legv_edilecek_ve_masa_azad_3d1fef')}
        error={cancelError}
        isOpen={isCancelDialogOpen}
        isSubmitting={isCancelling}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={(reason) => {
          void cancelReservation(reason)
        }}
        showReason
        title={i18n.t('ui.pages.customer.confirmation_page.rezervasiyani_legv_edirsiniz_a91268')}
      />
      {showDepositWaiverNotice ? (
        <div className="modal-backdrop reservation-action-backdrop" role="presentation">
          <section aria-labelledby="deposit-waiver-notice-title" aria-modal="true" className="reservation-action-dialog" role="dialog">
            <div className="reservation-action-dialog-body">
              <h2 id="deposit-waiver-notice-title">{i18n.t('ui.pages.customer.confirmation_page.depozit_telebi_legv_edildi_37ba61')}</h2>
              <p>{i18n.t('ui.pages.customer.confirmation_page.restoran_bu_rezervasiya_ucun_depozitde_424c75')}</p>
            </div>
            <footer className="reservation-action-dialog-actions">
              <Button onClick={() => setShowDepositWaiverNotice(false)} type="button">{i18n.t('ui.pages.customer.confirmation_page.basa_dusdum_4b99ad')}</Button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  )
}
