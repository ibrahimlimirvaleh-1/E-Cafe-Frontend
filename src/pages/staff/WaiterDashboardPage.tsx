import { BellRing, ReceiptText, Table2, WalletCards } from 'lucide-react'
import { orders, reservations, settlements } from '../../entities/mockData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

export function WaiterDashboardPage() {
  return (
    <main className="staff-page">
      <PageHeader
        eyebrow="Waiter"
        title="Ofisiant paneli"
        description="Rezerv, seçilmiş menyu, dine-in order və xidmət haqqı qazancı bir yerdə görünür."
      />
      <section className="metric-grid">
        <article className="metric-card">
          <Table2 size={22} />
          <span>Aktiv rezerv</span>
          <strong>{reservations.length}</strong>
          <small>Seated/Reserved kartları</small>
        </article>
        <article className="metric-card">
          <ReceiptText size={22} />
          <span>Order</span>
          <strong>{orders.length}</strong>
          <small>WaiterCreated əsas axın</small>
        </article>
        <article className="metric-card">
          <WalletCards size={22} />
          <span>Qazanc</span>
          <strong>{settlements[0]?.payableAmount.toFixed(2)} ₼</strong>
          <small>Settlement period üzrə</small>
        </article>
        <article className="metric-card">
          <BellRing size={22} />
          <span>Ready mesajı</span>
          <strong>{orders.filter((order) => order.status === 'Ready').length}</strong>
          <small>Kitchen Ready etdikdə gəlir</small>
        </article>
      </section>
      <section className="ticket-list">
        {orders.map((order) => (
          <article className="operation-card" key={order.id}>
            <div>
              <h2>{order.tableId}</h2>
              <p>{order.itemNames.join(', ')}</p>
            </div>
            <Badge tone={order.status === 'Ready' ? 'success' : 'warning'}>{order.status}</Badge>
          </article>
        ))}
      </section>
      <div className="action-row top-space">
        <ButtonLink to="/waiter/home">Ana səhifə</ButtonLink>
        <ButtonLink variant="secondary" to="/waiter/orders">Sifarişlər</ButtonLink>
      </div>
    </main>
  )
}
