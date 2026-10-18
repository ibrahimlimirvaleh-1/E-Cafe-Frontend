import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { ecafeApi, type ReservationRefundResponse } from '../../shared/api/ecafeApi'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { RefundHistory } from './RefundHistory'

type Props = { reservationId: string; restaurantId: string }

export function RestaurantRefundPanel({ reservationId, restaurantId }: Props) {
  const { i18n: translation } = useTranslation()
  const scope = `${restaurantId}:${reservationId}`
  const localizedScope = `${scope}:${translation.resolvedLanguage || translation.language}`
  const loadedRefundScopeRef = useRef('')
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])
  const { data: refund, error, hasData, isLoading } = useKeyedAsyncData<ReservationRefundResponse | null>(
    () => ecafeApi.reservations.getRefundForRestaurant(restaurantId, reservationId),
    null,
    localizedScope,
    [reloadKey],
  )
  useEffect(() => {
    if (refund) loadedRefundScopeRef.current = scope
  }, [refund, scope])

  if (!hasData && !error && loadedRefundScopeRef.current === scope) {
    return <section className="reservation-refund-panel reservation-manager-refund" aria-busy="true">
      <div className="reservation-refund-heading"><div><span className="section-eyebrow">{i18n.t('ui.features.reservations.restaurant_refund_panel.geri_odenis_b6e067')}</span><h2>{i18n.t('ui.features.reservations.restaurant_refund_panel.geri_odenis_a962bb')}</h2></div></div>
      <p className="reservation-refund-meta">{i18n.t('ui.features.reservations.reservation_refund_panel.yoxlanilir_b497d3')}</p>
    </section>
  }

  if (isLoading || (error && !hasData) || !refund) {
    return error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null
  }

  return (
    <section className="reservation-refund-panel reservation-manager-refund" aria-label={i18n.t('ui.features.reservations.restaurant_refund_panel.geri_odenis_a962bb')}>
      {error ? <StatusMessage tone="warning" autoHideMs={false}>{error}</StatusMessage> : null}
      <div className="reservation-refund-heading">
        <div><span className="section-eyebrow">{i18n.t('ui.features.reservations.restaurant_refund_panel.geri_odenis_b6e067')}</span><h2>{i18n.t('ui.features.reservations.restaurant_refund_panel.geri_odenis_a962bb')}</h2></div>
        <strong>{refund.amount.toFixed(2)} {refund.currencyCode}</strong>
      </div>
      <p className="reservation-refund-status" role="status">{refund.statusLabel || refund.status}</p>
      {refund.eligibilityReason ? <p className="reservation-refund-meta">{refund.eligibilityReason}</p> : null}
      {refund.requiresManualReview ? (
        <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.features.reservations.restaurant_refund_panel.bu_kohne_odenis_provaydere_bagli_deyil_16e5a1')}</StatusMessage>
      ) : <p className="reservation-refund-meta">{i18n.t('ui.features.reservations.restaurant_refund_panel.geri_odenisin_neticesi_provayder_tesdi_23dc66')}</p>}
      {refund.isTest ? <StatusMessage tone="info" autoHideMs={false}>{i18n.t('ui.features.reservations.restaurant_refund_panel.test_geri_odenisi_real_pul_kocurulmur_5be270')}</StatusMessage> : null}
      <RefundHistory items={refund.history || []} />
    </section>
  )
}
