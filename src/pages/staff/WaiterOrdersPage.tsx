import { orders } from '../../entities/mockData'
import { Badge } from '../../shared/ui/Badge'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function WaiterOrdersPage() {
  return (
    <main className="staff-page">
      <PageHeader title="Ofisiant sifarişləri" />
      <StatusMessage tone="info">Sifariş workflow-u backend-də aktivləşdirildikdən sonra əməliyyat düymələri burada görünəcək.</StatusMessage>
      <section className="ticket-list">
        {orders.map((order) => (
          <article className="operation-card" key={order.id}>
            <div>
              <h2>{order.id}</h2>
              <p>{order.itemNames.join(', ')}</p>
              <small>{order.source}</small>
            </div>
            <Badge tone={order.status === 'Ready' ? 'success' : 'warning'}>{order.status}</Badge>
          </article>
        ))}
      </section>
    </main>
  )
}
