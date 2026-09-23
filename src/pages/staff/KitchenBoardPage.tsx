import { orders } from '../../entities/mockData'
import { Badge } from '../../shared/ui/Badge'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function KitchenBoardPage() {
  return (
    <main className="staff-page">
      <PageHeader
        eyebrow="Kitchen"
        title="Mətbəx sifarişləri"
      />
      <StatusMessage tone="info">Sifariş workflow-u backend-də aktivləşdirildikdən sonra əməliyyat düymələri burada görünəcək.</StatusMessage>
      <section className="kitchen-board">
        {orders.map((order) => (
          <article className="kitchen-ticket" key={order.id}>
            <div>
              <span>{order.id}</span>
              <h2>{order.tableId}</h2>
              <Badge tone={order.status === 'Ready' ? 'success' : 'warning'}>{order.status}</Badge>
            </div>
            <ul>
              {order.itemNames.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  )
}
