import { CalendarClock, Clock, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi, type TableAvailabilityResponse } from '../../shared/api/ecafeApi'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getDefaultReservationDateTime() {
  const nextSlot = new Date()
  nextSlot.setHours(nextSlot.getHours() + 1, 0, 0, 0)

  return {
    date: toDateInputValue(nextSlot),
    time: toTimeInputValue(nextSlot),
  }
}

function buildReservedAt(date: string, time: string) {
  return `${date}T${time}:00+04:00`
}

function formatReservedAt(value: string) {
  const [date, timeWithOffset] = value.split('T')
  const time = timeWithOffset?.slice(0, 5)
  return [date, time].filter(Boolean).join(' / ')
}

export function ReservationTimePage() {
  const { restaurantId = '' } = useParams()
  const navigate = useNavigate()
  const defaults = useMemo(getDefaultReservationDateTime, [])
  const [date, setDate] = useState(defaults.date)
  const [time, setTime] = useState(defaults.time)
  const [availability, setAvailability] = useState<TableAvailabilityResponse | null>(null)
  const [error, setError] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const reservedAt = buildReservedAt(date, time)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setAvailability(null)
    setIsChecking(true)

    try {
      const result = await ecafeApi.tables.checkAvailability(restaurantId, reservedAt)
      setAvailability(result)

      if (result.hasAvailableTable) {
        const params = new URLSearchParams({
          reservedAt: result.reservedAt || reservedAt,
          availableCount: String(result.availableCount),
        })
        navigate(`/restaurants/${restaurantId}/tables?${params.toString()}`)
      }
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Boş masa yoxlanıla bilmədi.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <main className="page reservation-page">
      <ReservationStepper activeStep={1} />
      <PageHeader
        eyebrow="Rezervasiya"
        title="Gəliş vaxtını seç"
        description="Əvvəlcə tarix və saat seçilir. Seçilən anda uyğun masa yoxdursa, masa seçimi mərhələsinə keçilmir."
      />

      <section className="reservation-time-panel">
        <form className="reservation-time-form" onSubmit={handleSubmit}>
          <label>
            <span>Tarix</span>
            <input min={toDateInputValue(new Date())} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <label>
            <span>Gəliş saatı</span>
            <input onChange={(event) => setTime(event.target.value)} type="time" value={time} />
          </label>
          <Button className="reservation-time-submit" disabled={isChecking || !date || !time} type="submit">
            <Table2 size={18} />
            {isChecking ? 'Yoxlanılır...' : 'Boş masa yoxla'}
          </Button>
        </form>

        <div className="reservation-flow-note">
          <CalendarClock size={22} />
          <div>
            <strong>{formatReservedAt(reservedAt)}</strong>
            <span>Müştəri çıxış saatı seçmir. Rezerv olunmuş masa restoranın həmin gün bağlanma vaxtına qədər blokda qalır.</span>
          </div>
        </div>

        {availability && !availability.hasAvailableTable ? (
          <div className="reservation-availability-message warning">
            <Clock size={20} />
            <span>Bu saat üçün boş masa yoxdur. Başqa tarix və ya saat seçin.</span>
          </div>
        ) : null}

        {error ? (
          <div className="reservation-availability-message danger">
            <Clock size={20} />
            <span>{error}</span>
          </div>
        ) : null}

        <Link className="reservation-secondary-link" to={`/restaurants/${restaurantId}`}>
          Restoran profilinə qayıt
        </Link>
      </section>
    </main>
  )
}
