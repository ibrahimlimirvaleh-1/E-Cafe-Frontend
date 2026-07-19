import { Check, ChefHat, Clock } from 'lucide-react'
import { orders } from '../../entities/mockData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

export function KitchenBoardPage() {
  return (
    <main className="staff-page">
      <PageHeader
        eyebrow="Kitchen"
        title="Mətbəx sifarişləri"
        description="Kitchen yalnız Accepted, Preparing və Ready statuslarını idarə edir; payment və earning sahələrinə çıxışı yoxdur."
      />
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
            <footer>
              <Button variant="secondary" type="button">
                <Clock size={17} />
                Accepted
              </Button>
              <Button variant="secondary" type="button">
                <ChefHat size={17} />
                Preparing
              </Button>
              <Button type="button">
                <Check size={17} />
                Ready
              </Button>
            </footer>
          </article>
        ))}
      </section>
    </main>
  )
}
