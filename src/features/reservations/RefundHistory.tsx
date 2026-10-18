import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import type { ReservationRefundHistoryItem } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'

const actorKeys: Record<string, string> = {
  Customer: 'ui.history.actor.customer',
  Restaurant: 'ui.history.actor.restaurant',
  System: 'ui.history.actor.system',
}

export function RefundHistory({ items }: { items: ReservationRefundHistoryItem[] }) {
  useTranslation()
  if (!items.length) return null

  return (
    <details className="reservation-refund-attempts">
      <summary>{i18n.t('ui.features.reservations.refund_history.geri_odenis_tarixcesi_d0f1d1')}</summary>
      <ol className="reservation-refund-history">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.toStatusLabel || item.toStatus}</strong>
            <small>{formatReservationDateTime(item.changedAt)} · {actorKeys[item.actorType] ? i18n.t(actorKeys[item.actorType]) : item.actorType}</small>
            {(item.reasonLabel ?? item.reason) ? <p>{item.reasonLabel ?? item.reason}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  )
}
