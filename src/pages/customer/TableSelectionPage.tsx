import { CalendarClock, Users } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'

function formatReservedAt(value: string) {
  const [date, timeWithOffset] = value.split('T')
  const time = timeWithOffset?.slice(0, 5)
  return [date, time].filter(Boolean).join(' / ')
}

export function TableSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const [searchParams] = useSearchParams()
  const reservedAt = searchParams.get('reservedAt') || ''
  const { data: tables, isLoading } = useAsyncData(
    () => reservedAt ? ecafeApi.tables.listAvailableForReservation(restaurantId, reservedAt) : Promise.resolve([]),
    [],
    [restaurantId, reservedAt],
  )

  if (!reservedAt) {
    return (
      <main className="page">
        <ReservationStepper activeStep={1} />
        <PageHeader
          eyebrow="Rezervasiya"
          title="Əvvəl gəliş vaxtını seç"
          description="Masa seçimi yalnız tarix və saat yoxlandıqdan sonra açılır."
        />
        <Link className="ui-button ui-button-primary" to={`/restaurants/${restaurantId}/reserve`}>
          Vaxt seçiminə keç
        </Link>
      </main>
    )
  }

  return (
    <main className="page reservation-page">
      <ReservationStepper activeStep={2} />
      <PageHeader
        eyebrow="Rezervasiya"
        title="Uyğun masa seç"
        description="Bu siyahıda yalnız seçilən saat üçün rezervasiyaya uyğun masalar göstərilir."
      />
      <div className="reservation-flow-note compact">
        <CalendarClock size={20} />
        <div>
          <strong>{formatReservedAt(reservedAt)}</strong>
          <span>Masa müştəri üçün restoran bağlanana qədər rezerv blokunda saxlanılır.</span>
        </div>
      </div>
      {isLoading ? <p className="online-only">Masalar yüklənir...</p> : null}
      {!isLoading && tables.length === 0 ? <p className="online-only">Bu saat üçün uyğun masa yoxdur. Başqa saat seçin.</p> : null}
      <section className="choice-grid">
        {tables.map((table) => {
          const nextParams = new URLSearchParams(searchParams)
          nextParams.set('tableId', table.id)

          return (
            <Link className="choice-card" key={table.id} to={`/restaurants/${restaurantId}/menu?${nextParams.toString()}`}>
              <Users size={26} />
              <strong>{table.name || `Masa ${table.number}`}</strong>
              <span>{table.name && table.number ? `Masa ${table.number} · ${table.capacity} nəfərlik` : `${table.capacity} nəfərlik masa`}</span>
              <small>{table.status === 'Available' ? 'Boşdur' : table.status}</small>
            </Link>
          )
        })}
      </section>
    </main>
  )
}
