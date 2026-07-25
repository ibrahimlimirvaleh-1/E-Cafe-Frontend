import { BadgeCheck, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'

export function WaiterSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const { data: waiters, isLoading } = useAsyncData(() => ecafeApi.staff.waiters(restaurantId), [], [restaurantId])

  return (
    <main className="page">
      <ReservationStepper activeStep={3} />
      <PageHeader title="Ofisiant seç" />
      {isLoading ? <p className="online-only">Ofisiantlar yüklənir...</p> : null}
      {!isLoading && waiters.length === 0 ? <p className="online-only">Bu restoran üçün ofisiant tapılmadı.</p> : null}
      <section className="choice-grid">
        {waiters.map((waiter) => (
          <Link className="choice-card" key={waiter.id} to={`/restaurants/${restaurantId}/menu`}>
            <BadgeCheck size={26} />
            <strong>{waiter.name}</strong>
            <span>{waiter.status === 'Active' ? 'Aktiv' : 'Deaktiv'}</span>
            <small>
              <WalletCards size={15} />
              {waiter.serviceFeePercent == null ? 'Servis faizi restoran qaydasına görədir' : `Servis faizi: ${waiter.serviceFeePercent}%`}
            </small>
          </Link>
        ))}
      </section>
    </main>
  )
}
