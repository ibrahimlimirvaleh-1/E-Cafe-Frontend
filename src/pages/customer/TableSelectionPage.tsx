import { i18n } from '../../shared/i18n/i18n'
import { ArrowRight, CalendarClock, CheckCircle2, Users } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { ReservationPreorderDialog } from '../../features/menu/ReservationPreorderDialog'
import { ReservationDepositReviewDialog } from '../../features/menu/ReservationDepositReviewDialog'
import {
  getReservationErrorMessage,
  isCustomerDailyReservationLimit,
  isDepositAmountChanged,
  isTableReservationConflict,
} from '../../features/menu/reservationErrors'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi, type TableAvailabilityResponse } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getCurrentLanguage } from '../../shared/i18n/i18n'
import { getIntlLocale } from '../../shared/i18n/language'

function formatReservedAt(value: string) {
  const [date, timeWithOffset] = value.split('T')
  const time = timeWithOffset?.slice(0, 5)
  return [date, time].filter(Boolean).join(' / ')
}

function formatTime(value?: string | null, timeZone?: string) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  try {
    return new Intl.DateTimeFormat(getIntlLocale(getCurrentLanguage()), {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(getIntlLocale(getCurrentLanguage()), {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  }
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
  const [latestDepositAmount, setLatestDepositAmount] = useState<number | null>(null)
  const [pendingDepositAmount, setPendingDepositAmount] = useState<number | null>(null)
  const [acceptsLimitedSeating, setAcceptsLimitedSeating] = useState(false)
  const [reservationError, setReservationError] = useState('')
  const [reservationErrorTone, setReservationErrorTone] = useState<'danger' | 'warning'>('danger')
  const [unavailableTableIds, setUnavailableTableIds] = useState<Set<string>>(new Set())
  const { data: availability, error: availabilityError, isLoading } = useAsyncData<TableAvailabilityResponse | null>(
    async () => {
      if (!reservedAt) {
        return null
      }

      return ecafeApi.tables.checkAvailability(restaurantId, reservedAt)
    },
    null,
    [restaurantId, reservedAt, peopleCount],
  )
  const displayedDepositAmount = latestDepositAmount ?? availability?.depositAmount

  if (!reservedAt) {
    return (
      <main className="page">
        <ReservationStepper activeStep={1} />
        <PageHeader
          eyebrow={i18n.t('ui.pages.customer.table_selection_page.rezervasiya_9cf147')}
          title={i18n.t('ui.pages.customer.table_selection_page.evvel_gelis_vaxtini_sec_8baee1')}
        />
        <Link className="ui-button ui-button-primary" to={`/restaurants/${restaurantId}/reserve`}>{i18n.t('ui.pages.customer.table_selection_page.vaxt_secimine_kec_573f46')}</Link>
      </main>
    )
  }

  const handleTableSelect = (tableId: string) => {
    if (displayedDepositAmount === undefined) {
      setReservationError('Bu tarix üçün depozit məlumatı yüklənməyib. Səhifəni yeniləyib yenidən yoxlayın.')
      return
    }
    setReservationError('')
    setReservationErrorTone('danger')
    setSelectedTableId(tableId)
    setAcceptsLimitedSeating(false)
  }

  const handlePreorder = () => {
    if (!selectedTableId || displayedDepositAmount === undefined) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tableId', selectedTableId)
    nextParams.set('shownDepositAmount', String(displayedDepositAmount))
    if (selectedTable?.mustVacateAt && acceptsLimitedSeating) {
      nextParams.set('acceptsLimitedSeating', 'true')
    }
    navigate(`/restaurants/${restaurantId}/menu?${nextParams.toString()}`)
  }

  const createReservation = async (depositAmount: number) => {
    if (!selectedTableId) return
    const reservation = await ecafeApi.reservations.create(restaurantId, {
      tableId: selectedTableId,
      reservedAt,
      peopleCount,
      acceptsLimitedSeating,
      expectedDepositAmount: depositAmount,
    })
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tableId', selectedTableId)
    nextParams.set('reservationId', String(reservation.id))
    navigate(`/confirmation?${nextParams.toString()}`)
  }

  const handleCreateError = async (error: unknown) => {
    if (isDepositAmountChanged(error)) {
      try {
        const currentAmount = (await ecafeApi.tables.checkAvailability(restaurantId, reservedAt)).depositAmount
        if (currentAmount !== undefined) {
          setLatestDepositAmount(currentAmount)
          setPendingDepositAmount(currentAmount)
          return
        }
      } catch {
        // Keep the original error when the refreshed quote is unavailable.
      }
    }
    const tableConflict = isTableReservationConflict(error)
    if (tableConflict && selectedTableId) {
      setUnavailableTableIds((current) => new Set(current).add(selectedTableId))
      setSelectedTableId(null)
    }
    setReservationErrorTone(isCustomerDailyReservationLimit(error) ? 'warning' : 'danger')
    setReservationError(getReservationErrorMessage(error))
  }

  const handleReservationOnly = async () => {
    if (!selectedTableId) return

    setReservationError('')
    setReservationErrorTone('danger')
    setIsCreatingReservation(true)

    try {
      const currentAmount = (await ecafeApi.tables.checkAvailability(restaurantId, reservedAt)).depositAmount
      if (currentAmount === undefined) {
        setReservationError('Bu tarix üçün depozit məlumatı yüklənməyib. Yenidən yoxlayın.')
        return
      }
      setLatestDepositAmount(currentAmount)
      if ((displayedDepositAmount === undefined && currentAmount > 0) ||
          (displayedDepositAmount !== undefined && currentAmount !== displayedDepositAmount)) {
        setPendingDepositAmount(currentAmount)
        return
      }
      await createReservation(currentAmount)
    } catch (error) {
      await handleCreateError(error)
    } finally {
      setIsCreatingReservation(false)
    }
  }

  const confirmDepositAmount = async () => {
    if (pendingDepositAmount === null) return
    setIsCreatingReservation(true)
    setReservationError('')
    try {
      await createReservation(pendingDepositAmount)
      setPendingDepositAmount(null)
    } catch (error) {
      setPendingDepositAmount(null)
      await handleCreateError(error)
    } finally {
      setIsCreatingReservation(false)
    }
  }

  const tables = availability?.tables ?? []
  const visibleTables = isLoading || availabilityError
    ? []
    : tables
      .filter((table) => table.capacity >= peopleCount)
      .filter((table) => !unavailableTableIds.has(table.id))
  const selectedTable = visibleTables.find((table) => table.id === selectedTableId) ?? null
  const limitedSeatingMessage = selectedTable?.mustVacateAt
    ? `Bu masa növbəti rezervasiya üçün ayrılıb. Ən geci ${formatTime(selectedTable.mustVacateAt, availability?.restaurantTimeZone)}-də masanı təhvil vermə şərti ilə razıyam.`
    : null

  return (
    <main className="page reservation-page">
      <ReservationStepper activeStep={2} />
      <PageHeader
        eyebrow={i18n.t('ui.pages.customer.table_selection_page.rezervasiya_9cf147')}
        title={i18n.t('ui.pages.customer.table_selection_page.uygun_masa_sec_5dd583')}
      />
      <div className="reservation-selection-summary reservation-table-selection-summary">
        <div className="reservation-selection-summary-main">
          <div className="reservation-panel-icon">
            <CalendarClock size={20} />
          </div>
          <div>
            <span>{i18n.t('ui.pages.customer.table_selection_page.secilmis_vaxt_d1a611')}</span>
            <strong>{formatReservedAt(reservedAt)}</strong>
          </div>
        </div>
        <div>
          <span className="reservation-summary-caption">{i18n.t('ui.pages.customer.table_selection_page.qonaq_sayi_012aa3')}</span>
          <strong>{i18n.t('ui.count.guests', { count: peopleCount })}</strong>
        </div>
        {displayedDepositAmount !== undefined ? (
          <div><span className="reservation-summary-caption">{i18n.t('ui.pages.customer.table_selection_page.depozit_4a14b8')}</span><strong>{displayedDepositAmount > 0 ? `${displayedDepositAmount.toFixed(2)} AZN` :i18n.t('ui.pages.customer.table_selection_page.teleb_olunmur_46f021')}</strong></div>
        ) : null}
      </div>
      <div className="reservation-table-toolbar">
        <div>
          <strong>{i18n.t('ui.pages.customer.table_selection_page.uygun_masalar_ff19c4')}</strong>
        </div>
        <div className="reservation-table-legend"><span><i className="available" /> {i18n.t('ui.pages.customer.table_selection_page.bosdur_23162a')}</span><span><i className="capacity" /> {i18n.t('ui.pages.customer.table_selection_page.tutum_1c836d')}</span></div>
      </div>
      {availability?.message ? (
        <p className={`reservation-availability-message ${availability.hasAvailableTable ? 'success' : 'warning'}`}>
          {availability.message}
        </p>
      ) : null}
      {reservationError ? <p className={`reservation-availability-message ${reservationErrorTone}`}>{reservationError}</p> : null}
      {availabilityError ? <p className="reservation-availability-message danger">{i18n.t('ui.pages.customer.table_selection_page.masalarin_veziyyeti_yuklenmedi_sehifen_924e25')}</p> : null}
      {isLoading ? <p className="online-only">{i18n.t('ui.pages.customer.table_selection_page.masalar_yuklenir_fa9b85')}</p> : null}
      {!isLoading && !availabilityError && visibleTables.length === 0 ? <p className="online-only">{availability?.message || 'Bu saat üçün uyğun masa yoxdur. Başqa saat seçin.'}</p> : null}
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
                <div className="reservation-table-number"><span>{i18n.t('ui.pages.customer.table_selection_page.masa_058c4c')}</span><strong>{table.name || table.number}</strong></div>
                <CheckCircle2 size={21} />
              </div>
              <div className="reservation-table-card-meta">
                <span><Users size={16} /> {table.capacity} {i18n.t('ui.pages.customer.table_selection_page.neferlik_2dc0b2')}</span>
                <small>{table.mustVacateAt ? `${formatTime(table.mustVacateAt, availability?.restaurantTimeZone)}-dək` : table.status === 'Available' ?i18n.t('ui.pages.customer.table_selection_page.bosdur_23162a') : table.status}</small>
              </div>
              <div className="reservation-table-card-action">{i18n.t('ui.pages.customer.table_selection_page.sec_6caa06')} <ArrowRight size={17} /></div>
            </button>
          )
        })}
      </section>
      <ReservationPreorderDialog
        isOpen={Boolean(selectedTableId) && pendingDepositAmount === null}
        isSubmitting={isCreatingReservation}
        depositAmount={displayedDepositAmount}
        onCancel={() => {
          setSelectedTableId(null)
          setAcceptsLimitedSeating(false)
        }}
        onPreorder={handlePreorder}
        onSkip={handleReservationOnly}
        limitedSeatingMessage={limitedSeatingMessage}
        acceptsLimitedSeating={acceptsLimitedSeating}
        onAcceptLimitedSeating={setAcceptsLimitedSeating}
      />
      <ReservationDepositReviewDialog
        amount={pendingDepositAmount}
        isChanged
        isSubmitting={isCreatingReservation}
        onCancel={() => setPendingDepositAmount(null)}
        onConfirm={() => void confirmDepositAmount()}
      />
    </main>
  )
}
