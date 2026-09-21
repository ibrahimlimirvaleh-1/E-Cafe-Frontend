import { ArrowRight, CalendarClock, CheckCircle2, Users } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { ReservationPreorderDialog } from '../../features/menu/ReservationPreorderDialog'
import { getReservationErrorMessage } from '../../features/menu/reservationErrors'
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reservedAt = searchParams.get('reservedAt') || ''
  const parsedPeopleCount = Number(searchParams.get('peopleCount') || '1')
  const peopleCount = Number.isFinite(parsedPeopleCount) && parsedPeopleCount > 0 ? parsedPeopleCount : 1
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [reservationError, setReservationError] = useState('')
  const [unavailableTableIds, setUnavailableTableIds] = useState<Set<string>>(new Set())
  const { data: tables, error: availabilityError, isLoading } = useAsyncData(
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
        />
        <Link className="ui-button ui-button-primary" to={`/restaurants/${restaurantId}/reserve`}>
          Vaxt seçiminə keç
        </Link>
      </main>
    )
  }

  const handleTableSelect = (tableId: string) => {
    setReservationError('')
    setSelectedTableId(tableId)
  }

  const handlePreorder = () => {
    if (!selectedTableId) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tableId', selectedTableId)
    navigate(`/restaurants/${restaurantId}/menu?${nextParams.toString()}`)
  }

  const handleReservationOnly = async () => {
    if (!selectedTableId) {
      return
    }

    setReservationError('')
    setIsCreatingReservation(true)

    try {
      const reservation = await ecafeApi.reservations.create(restaurantId, {
        tableId: selectedTableId,
        reservedAt,
        peopleCount,
      })
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('tableId', selectedTableId)
      nextParams.set('reservationId', String(reservation.id))
      navigate(`/confirmation?${nextParams.toString()}`)
    } catch (error) {
      setUnavailableTableIds((current) => new Set(current).add(selectedTableId))
      setSelectedTableId(null)
      setReservationError(getReservationErrorMessage(error))
    } finally {
      setIsCreatingReservation(false)
    }
  }

  const visibleTables = isLoading || availabilityError
    ? []
    : tables.filter((table) => !unavailableTableIds.has(table.id))

  return (
    <main className="page reservation-page">
      <ReservationStepper activeStep={2} />
      <PageHeader
        eyebrow="Rezervasiya"
        title="Uyğun masa seç"
      />
      <div className="reservation-selection-summary reservation-table-selection-summary">
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
      </div>
      <div className="reservation-table-toolbar">
        <div>
          <strong>Uyğun masalar</strong>
        </div>
        <div className="reservation-table-legend"><span><i className="available" /> Boşdur</span><span><i className="capacity" /> Tutum</span></div>
      </div>
      {reservationError ? <p className="reservation-availability-message danger">{reservationError}</p> : null}
      {availabilityError ? <p className="reservation-availability-message danger">Masaların vəziyyəti yüklənmədi. Səhifəni yeniləyib yenidən yoxlayın.</p> : null}
      {isLoading ? <p className="online-only">Masalar yüklənir...</p> : null}
      {!isLoading && !availabilityError && visibleTables.length === 0 ? <p className="online-only">Bu saat üçün uyğun masa yoxdur. Başqa saat seçin.</p> : null}
      <section className="choice-grid reservation-table-grid">
        {visibleTables.map((table) => {
          return (
            <button
              className={`choice-card reservation-table-card${selectedTableId === table.id ? ' selected' : ''}`}
              key={table.id}
              onClick={() => handleTableSelect(table.id)}
              type="button"
            >
              <div className="reservation-table-card-top">
                <div className="reservation-table-number"><span>Masa</span><strong>{table.name || table.number}</strong></div>
                <CheckCircle2 size={21} />
              </div>
              <div className="reservation-table-card-meta">
                <span><Users size={16} /> {table.capacity} nəfərlik</span>
                <small>{table.status === 'Available' ? 'Boşdur' : table.status}</small>
              </div>
              <div className="reservation-table-card-action">Seç <ArrowRight size={17} /></div>
            </button>
          )
        })}
      </section>
      <ReservationPreorderDialog
        isOpen={Boolean(selectedTableId)}
        isSubmitting={isCreatingReservation}
        onCancel={() => setSelectedTableId(null)}
        onPreorder={handlePreorder}
        onSkip={handleReservationOnly}
      />
    </main>
  )
}
