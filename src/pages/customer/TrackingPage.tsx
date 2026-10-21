import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { CalendarDays, LogOut, MapPin, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ReservationHistoryTimeline } from '../../features/reservations/ReservationHistoryTimeline'
import { CustomerDepositCheckoutPanel } from '../../features/reservations/CustomerDepositCheckoutPanel'
import { ReservationRefundPanel } from '../../features/reservations/ReservationRefundPanel'
import { ReservationLateArrivalPanel } from '../../features/reservations/ReservationLateArrivalPanel'
import { ReservationWaitingSummary } from '../../features/reservations/ReservationWaitingSummary'
import type { ReservationHistoryResponse, ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationDepartureReasonLabel, getReservationStatusPresentation } from '../../shared/lib/reservationStatus'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function TrackingPage() {
  const { i18n: translation } = useTranslation()
  const language = translation.resolvedLanguage || translation.language
  const { user } = useAuth()
  const { token = '' } = useParams()
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const onRefresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', onRefresh)
  }, [])
  const { data: reservation, error, hasData, isLoading } = useKeyedAsyncData<ReservationResponse | null>(
    async () => {
      if (/^\d+$/.test(token)) {
        return ecafeApi.reservations.getById(token)
      }

      const result = await ecafeApi.reservations.listMine({ pageNumber: 1, pageSize: 1 })
      return result.items[0] ?? null
    },
    null,
    `${user?.userId || ''}:${token}`,
    [user?.userId, token, reloadKey],
  )
  const isWaiting = Boolean(reservation?.waiting || reservation?.requiresReceptionReview)
  useEffect(() => {
    if (!isWaiting) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setReloadKey((value) => value + 1)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [isWaiting])
  const { data: history } = useKeyedAsyncData<ReservationHistoryResponse | null>(
    () => reservation ? ecafeApi.reservations.getHistory(String(reservation.id)) : Promise.resolve(null),
    null,
    `${user?.userId || ''}:${reservation?.id || ''}`,
    [user?.userId, reservation?.id, language, reloadKey],
  )

  const presentation = reservation ? getReservationStatusPresentation(reservation.status) : null

  return (
    <main className="page tracking-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.customer.tracking_page.rezervasiya_9cf147')}
        title={i18n.t('ui.pages.customer.tracking_page.rezervasiyani_izle_829de4')}
        description={i18n.t('ui.pages.customer.tracking_page.statusu_odenisi_ve_proses_tarixcesini__2f12e1')}
      />

      {isLoading ? <p className="online-only">{i18n.t('ui.pages.customer.tracking_page.rezervasiya_melumatlari_yuklenir_cbd94d')}</p> : null}
      {error ? <StatusMessage autoHideMs={false} tone="danger">{error}</StatusMessage> : null}

      {!isLoading && (!error || hasData) && !reservation ? (
        <section className="tracking-panel reservation-empty-state">
          <CalendarDays size={28} />
          <h2>{i18n.t('ui.pages.customer.tracking_page.izlenecek_rezervasiya_yoxdur_aafe5d')}</h2>
          <p>{i18n.t('ui.pages.customer.tracking_page.rezervasiya_yaratdiqdan_sonra_onun_sta_933a6a')}</p>
          <ButtonLink to="/reservations">{i18n.t('ui.pages.customer.tracking_page.rezervasiyalarim_52105e')}</ButtonLink>
        </section>
      ) : null}

      {reservation && presentation ? (
        <div className="tracking-reservation-layout">
          <section className="tracking-panel">
            <header className="tracking-hero">
              <div>
                <span className="tracking-eyebrow">{i18n.t('ui.pages.customer.tracking_page.rezervasiya_a13388')}{reservation.id}</span>
                <h2>{reservation.restaurantName || 'Restoran rezervasiyası'}</h2>
                <p>{reservation.tableName || `Masa ${reservation.tableId}`}</p>
              </div>
              <Badge tone={presentation.tone}>{presentation.label}</Badge>
            </header>

            <div className="tracking-content-grid">
              <section className="tracking-items" aria-label={i18n.t('ui.pages.customer.tracking_page.rezervasiya_melumatlari_fba5af')}>
                <div className="tracking-section-heading">
                  <span>{i18n.t('ui.pages.customer.tracking_page.rezervasiya_melumatlari_3da517')}</span>
                  <strong>{i18n.t('ui.count.guests', { count: reservation.peopleCount })}</strong>
                </div>
                <ul>
                  <li><CalendarDays size={17} />{formatReservationDateTime(reservation.reservedAt, reservation.timeZone || undefined)}</li>
                  <li><MapPin size={17} />{reservation.tableName || `Masa ${reservation.tableId}`}</li>
                  <li><Users size={17} />{i18n.t('ui.count.guests', { count: reservation.peopleCount })}</li>
                  {reservation.departureReason ? <li><LogOut size={17} />{i18n.t('ui.pages.customer.tracking_page.ayrilma_1dc94d')} {getReservationDepartureReasonLabel(reservation.departureReason)}</li> : null}
                </ul>
              </section>
              <section className="tracking-total" aria-label={i18n.t('ui.pages.customer.tracking_page.depozit_melumati_223fe1')}>
                <span>{i18n.t('ui.pages.customer.tracking_page.depozit_1af98c')}</span>
                <strong>{reservation.depositAmount > 0 ? `${reservation.depositAmount.toFixed(2)} AZN` :i18n.t('ui.pages.customer.tracking_page.teleb_olunmur_46f021')}</strong>
                <small>
                  {reservation.holdExpiresAt
                    ? `Ödəniş üçün son vaxt: ${formatReservationDateTime(reservation.holdExpiresAt)}`
                    : reservation.restaurantResponseExpiresAt
                      ? `Cavab üçün son vaxt: ${formatReservationDateTime(reservation.restaurantResponseExpiresAt)}`
                      : reservation.depositAmount > 0 ?i18n.t('ui.pages.customer.tracking_page.elave_odenis_muddeti_yoxdur_dbcf1c') :i18n.t('ui.pages.customer.tracking_page.rezervasiya_odenissiz_tesdiqlenib_82467b')}
                </small>
              </section>
            </div>

            <ReservationWaitingSummary waiting={reservation.waiting} requiresReceptionReview={reservation.requiresReceptionReview} timeZone={reservation.timeZone} viewer="customer" />
            <ReservationLateArrivalPanel reservation={reservation} refreshKey={reloadKey} onChanged={() => setReloadKey((value) => value + 1)} />
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
              refundRequest={reservation.refundRequest}
            />

            <div className="tracking-page-actions">
              <ButtonLink to={`/confirmation?reservationId=${reservation.id}`}>{i18n.t('ui.pages.customer.tracking_page.rezervasiya_detallarina_bax_053606')}</ButtonLink>
            </div>
          </section>

          <ReservationHistoryTimeline items={history?.items || []} arrivedAt={history?.arrivedAt ?? reservation.arrivedAt} seatedAt={history?.seatedAt ?? reservation.seatedAt} requiresReceptionReview={reservation.requiresReceptionReview} timeZone={reservation.timeZone || undefined} />
        </div>
      ) : null}
    </main>
  )
}
