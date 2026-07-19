import { BadgeCheck, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { PageHeader } from '../../shared/ui/PageHeader'

export function WaiterSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const waiters = ecafeApi.staff.waiters(restaurantId)

  return (
    <main className="page">
      <ReservationStepper activeStep={3} />
      <PageHeader title="Ofisiant seç" description="Ofisiant seçimi rezervə bağlanır və təsdiqdən sonra waiter/manager mesajı yaranır." />
      <section className="choice-grid">
        {waiters.map((waiter) => (
          <Link className="choice-card" key={waiter.id} to={`/restaurants/${restaurantId}/menu`}>
            <BadgeCheck size={26} />
            <strong>{waiter.name}</strong>
            <span>{waiter.status}</span>
            <small>
              <WalletCards size={15} />
              Service fee: {waiter.serviceFeePercent ?? 'default'}%
            </small>
          </Link>
        ))}
      </section>
    </main>
  )
}
