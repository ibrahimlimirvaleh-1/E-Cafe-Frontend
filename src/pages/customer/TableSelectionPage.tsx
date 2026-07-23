import { Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'

export function TableSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const { data: tables, isLoading } = useAsyncData(() => ecafeApi.tables.listAvailable(restaurantId, 2), [], [restaurantId])

  return (
    <main className="page">
      <ReservationStepper activeStep={2} />
      <PageHeader title="Adam sayına uyğun masa seç" description="Backend hazır olan public table endpoint-ləri əsasında görünən masalar göstərilir." />
      {isLoading ? <p className="online-only">Masalar yüklənir...</p> : null}
      {!isLoading && tables.length === 0 ? <p className="online-only">Bu restoran üçün public masa tapılmadı.</p> : null}
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
