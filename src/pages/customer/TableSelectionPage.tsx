import { Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { PageHeader } from '../../shared/ui/PageHeader'

export function TableSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const tables = ecafeApi.tables.listAvailable(restaurantId, 2)

  return (
    <main className="page">
      <ReservationStepper activeStep={2} />
      <PageHeader title="Adam sayına uyğun masa seç" description="Availability backend-də interval overlap qaydası ilə qorunacaq." />
      <section className="choice-grid">
        {tables.map((table) => (
          <Link className="choice-card" key={table.id} to={`/restaurants/${restaurantId}/waiters`}>
            <Users size={26} />
            <strong>{table.number}</strong>
            <span>{table.capacity} nəfərlik masa</span>
            <small>{table.status}</small>
          </Link>
        ))}
      </section>
    </main>
  )
}
