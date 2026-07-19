import { orders } from '../../entities/mockData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

export function WaiterOrdersPage() {
  return (
    <main className="staff-page">
      <PageHeader title="Ofisiant sifarişləri" description="Masa üzrə sifarişləri izlə, hazır olanları servisə yönləndir." />
      <section className="ticket-list">
        {orders.map((order) => (
          <article className="operation-card" key={order.id}>
            <div>
              <h2>{order.id}</h2>
              <p>{order.itemNames.join(', ')}</p>
              <small>{order.source}</small>
            </div>
            <Badge tone={order.status === 'Ready' ? 'success' : 'warning'}>{order.status}</Badge>
            <Button type="button">Served et</Button>
          </article>
        ))}
      </section>
    </main>
  )
}
