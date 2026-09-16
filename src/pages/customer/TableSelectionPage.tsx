import { ArrowRight, CalendarClock, CheckCircle2, Users } from 'lucide-react'
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
  const parsedPeopleCount = Number(searchParams.get('peopleCount') || '1')
  const peopleCount = Number.isFinite(parsedPeopleCount) && parsedPeopleCount > 0 ? parsedPeopleCount : 1
  const { data: tables, isLoading } = useAsyncData(
    async () => {
      if (!reservedAt) {
        return []
      }

      const availableTables = await ecafeApi.tables.listAvailableForReservation(restaurantId, reservedAt)
      return availableTables.filter((table) => table.capacity >= peopleCount)
    },
    [],
    [restaurantId, reservedAt, peopleCount],
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
      <div className="reservation-selection-summary">
        <div className="reservation-selection-summary-main">
          <div className="reservation-panel-icon">
            <CalendarClock size={20} />
          </div>
          <div>
            <span>Seçilmiş vaxt</span>
            <strong>{formatReservedAt(reservedAt)}</strong>
          </div>
        </div>
        <div>
          <span className="reservation-summary-caption">Qonaq sayı</span>
          <strong>{peopleCount} nəfər</strong>
        </div>
        <div>
          <span className="reservation-summary-caption">Masa qaydası</span>
          <strong>Bağlanana qədər</strong>
        </div>
      </div>
      <div className="reservation-table-toolbar">
        <div>
          <strong>Uyğun masalar</strong>
          <span>Seçilən vaxt üçün boş olan masalardan birini seçin.</span>
        </div>
        <div className="reservation-table-legend"><span><i className="available" /> Boşdur</span><span><i className="capacity" /> Tutum</span></div>
      </div>
      {isLoading ? <p className="online-only">Masalar yüklənir...</p> : null}
      {!isLoading && tables.length === 0 ? <p className="online-only">Bu saat üçün uyğun masa yoxdur. Başqa saat seçin.</p> : null}
      <section className="choice-grid reservation-table-grid">
        {tables.map((table) => {
          const nextParams = new URLSearchParams(searchParams)
          nextParams.set('tableId', table.id)

          return (
            <Link className="choice-card reservation-table-card" key={table.id} to={`/restaurants/${restaurantId}/menu?${nextParams.toString()}`}>
              <div className="reservation-table-card-top">
                <div className="reservation-table-number"><span>Masa</span><strong>{table.name || table.number}</strong></div>
                <CheckCircle2 size={21} />
              </div>
              <div className="reservation-table-card-meta">
                <span><Users size={16} /> {table.capacity} nəfərlik</span>
                <small>{table.status === 'Available' ? 'Boşdur' : table.status}</small>
              </div>
              <div className="reservation-table-card-action">Seç <ArrowRight size={17} /></div>
            </Link>
          )
        })}
      </section>
    </main>
  )
}
