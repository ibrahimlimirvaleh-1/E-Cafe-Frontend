import { orders } from '../../entities/mockData'
import type { OrderStatus } from '../../entities/types'
import { Badge } from '../../shared/ui/Badge'
import { PageHeader } from '../../shared/ui/PageHeader'

const regularStatusSteps: OrderStatus[] = ['Created', 'Accepted', 'Preparing', 'Ready', 'Served', 'Closed']
const scheduledStatusSteps: OrderStatus[] = ['Scheduled', ...regularStatusSteps]
const statusLabels: Record<OrderStatus, string> = {
  Scheduled: 'Planlaşdırılıb',
  Created: 'Qəbul gözləyir',
  Accepted: 'Qəbul edildi',
  Preparing: 'Hazırlanır',
  Ready: 'Hazırdır',
  Served: 'Təqdim edildi',
  Closed: 'Bağlandı',
  Cancelled: 'Ləğv edildi',
}

const statusTone = (status: OrderStatus) => {
  if (status === 'Cancelled') return 'danger' as const
  if (status === 'Closed' || status === 'Served') return 'success' as const
  return 'warning' as const
}

export function TrackingPage() {
  const order = orders[0]
  const statusSteps = order.status === 'Scheduled' ? scheduledStatusSteps : regularStatusSteps
  const activeIndex = statusSteps.indexOf(order.status)
  const isCancelled = order.status === 'Cancelled'

  return (
    <main className="page tracking-page">
      <PageHeader title="Sifariş izləmə" />
      <section className="tracking-panel">
        <header className="tracking-hero">
          <div>
            <span className="tracking-eyebrow">SİFARİŞ</span>
            <h2>{order.id}</h2>
            <p>{order.tableId} · {order.source === 'CustomerCreated' ? 'Müştəri sifarişi' : 'Personal sifarişi'}</p>
          </div>
          <Badge tone={statusTone(order.status)}>{statusLabels[order.status]}</Badge>
        </header>

        {isCancelled ? (
          <div className="tracking-cancelled">Bu sifariş ləğv edilib.</div>
        ) : (
          <div className="status-timeline" aria-label="Sifariş statusu">
            {statusSteps.map((step, index) => (
              <div className={index <= activeIndex ? 'done' : ''} key={step}>
                <span>{index + 1}</span>
                <strong>{statusLabels[step]}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="tracking-content-grid">
          <section className="tracking-items">
            <div className="tracking-section-heading">
              <span>SİFARİŞ TƏRKİBİ</span>
              <strong>{order.itemNames.length} məhsul</strong>
            </div>
            <ul>
              {order.itemNames.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
          <section className="tracking-total">
            <span>ÜMUMİ MƏBLƏĞ</span>
            <strong>{order.total.toFixed(2)} ₼</strong>
            <small>{order.paymentStatus === 'Paid' ? 'Ödəniş edildi' : 'Ödəniş gözləyir'}</small>
          </section>
        </div>
      </section>
    </main>
  )
}
