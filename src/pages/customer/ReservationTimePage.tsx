import { CalendarClock, CheckCircle2, Clock, Table2, Users } from 'lucide-react'
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

const hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const minuteOptions = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))

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
  const [peopleCount, setPeopleCount] = useState('2')
  const [availability, setAvailability] = useState<TableAvailabilityResponse | null>(null)
  const [error, setError] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const reservedAt = buildReservedAt(date, time)
  const [hours, minutes] = time.split(':')

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
          peopleCount,
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
      />

      <section className="reservation-time-panel">
        <div className="reservation-panel-heading">
          <div className="reservation-panel-icon">
            <CalendarClock size={22} />
          </div>
          <div>
            <h2>Rezervasiya detallarını daxil edin</h2>
          </div>
        </div>

        <form className="reservation-time-form" onSubmit={handleSubmit}>
          <label className="reservation-field">
            <span>Tarix</span>
            <input min={toDateInputValue(new Date())} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <label className="reservation-field">
            <span>Gəliş saatı</span>
            <div className="reservation-time-input" role="group" aria-label="Gəliş saatı">
              <select aria-label="Saat" onChange={(event) => setTime(`${event.target.value}:${minutes}`)} value={hours}>
                {hourOptions.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
              </select>
              <b>:</b>
              <select aria-label="Dəqiqə" onChange={(event) => setTime(`${hours}:${event.target.value}`)} value={minutes}>
                {minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
              </select>
            </div>
          </label>
          <label className="reservation-field">
            <span>Qonaq sayı</span>
            <input
              min="1"
              max="100"
              onChange={(event) => setPeopleCount(event.target.value)}
              type="number"
              value={peopleCount}
            />
          </label>
          <Button
            className="reservation-time-submit"
            disabled={isChecking || !date || !time || !peopleCount || Number(peopleCount) < 1}
            type="submit"
          >
            <Table2 size={18} />
            {isChecking ? 'Yoxlanılır...' : 'Boş masa yoxla'}
          </Button>
        </form>

        <div className="reservation-time-preview">
          <div className="reservation-preview-label">
            <span>Seçiminiz</span>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <strong><CalendarClock size={18} /> {formatReservedAt(reservedAt)}</strong>
            <strong><Users size={18} /> {peopleCount} nəfər</strong>
          </div>
        </div>

        {availability && !availability.hasAvailableTable ? (
          <div className="reservation-availability-message warning">
            <Clock size={20} />
            <span>
              {availability.isRestaurantOpen
                ? availability.message || 'Bu saat üçün boş masa yoxdur. Başqa tarix və ya saat seçin.'
                : availability.message || 'Seçdiyiniz tarix və saatda restoran bağlıdır. Başqa vaxt seçin.'}
            </span>
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
