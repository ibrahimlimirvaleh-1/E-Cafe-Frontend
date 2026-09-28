import type { ReservationHistoryItem } from '../../shared/api/ecafeApi'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'

const actorNames: Record<string, string> = {
  Customer: 'Müştəri',
  Restaurant: 'Restoran',
  System: 'Sistem',
}

export function RefundHistory({ items }: { items: ReservationHistoryItem[] }) {
  if (!items.length) return null

  return (
    <details className="reservation-refund-attempts">
      <summary>Geri ödəniş tarixçəsi</summary>
      <ol className="reservation-refund-history">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.toStatus}</strong>
            <small>{formatReservationDateTime(item.changedAt)} · {actorNames[item.actorType] || item.actorType}</small>
            {item.reason ? <p>{item.reason}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  )
}
