import { useEffect, useState } from 'react'
import { ecafeApi, type ReservationRefundResponse } from '../../shared/api/ecafeApi'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { RefundHistory } from './RefundHistory'

type Props = { reservationId: string; restaurantId: string }

export function RestaurantRefundPanel({ reservationId, restaurantId }: Props) {
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])
  const { data: refund, error, hasData, isLoading } = useKeyedAsyncData<ReservationRefundResponse | null>(
    () => ecafeApi.reservations.getRefundForRestaurant(restaurantId, reservationId),
    null,
    `${restaurantId}:${reservationId}`,
    [restaurantId, reservationId, reloadKey],
  )

  if (isLoading || (error && !hasData) || !refund) {
    return error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null
  }

  return (
    <section className="reservation-refund-panel reservation-manager-refund" aria-label="Geri ödəniş">
      {error ? <StatusMessage tone="warning" autoHideMs={false}>{error}</StatusMessage> : null}
      <div className="reservation-refund-heading">
        <div><span className="section-eyebrow">GERİ ÖDƏNİŞ</span><h2>Geri ödəniş</h2></div>
        <strong>{refund.amount.toFixed(2)} {refund.currencyCode}</strong>
      </div>
      <p className="reservation-refund-status" role="status">{refund.status}</p>
      {refund.eligibilityReason ? <p className="reservation-refund-meta">{refund.eligibilityReason}</p> : null}
      {refund.requiresManualReview ? (
        <StatusMessage tone="warning" autoHideMs={false}>Bu köhnə ödəniş provayderə bağlı deyil. Avtomatik geri köçürmə yoxdur; dəstək tərəfindən ayrıca yoxlanmalıdır.</StatusMessage>
      ) : <p className="reservation-refund-meta">Geri ödənişin nəticəsi provayder təsdiqindən sonra yenilənir.</p>}
      {refund.isTest ? <StatusMessage tone="info" autoHideMs={false}>Test geri ödənişi: real pul köçürülmür.</StatusMessage> : null}
      <RefundHistory items={refund.history || []} />
    </section>
  )
}
