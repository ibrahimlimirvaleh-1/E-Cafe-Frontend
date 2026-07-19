import { orders } from '../../entities/mockData'
import { Badge } from '../../shared/ui/Badge'
import { PageHeader } from '../../shared/ui/PageHeader'

const statusSteps = ['Created', 'Accepted', 'Preparing', 'Ready', 'Served', 'Closed']

export function TrackingPage() {
  const order = orders[0]
  const activeIndex = statusSteps.indexOf(order.status)

  return (
    <main className="page narrow">
      <PageHeader title="Sifariş izləmə" description="Sifarişin mətbəxdən masaya qədər hansı mərhələdə olduğunu izlə." />
      <section className="tracking-panel">
        <div className="tracking-head">
          <div>
            <span>Order</span>
            <h2>{order.id}</h2>
          </div>
          <Badge tone="warning">{order.status}</Badge>
        </div>
        <div className="status-timeline">
          {statusSteps.map((step, index) => (
            <div className={index <= activeIndex ? 'done' : ''} key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
        <ul>
          {order.itemNames.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
