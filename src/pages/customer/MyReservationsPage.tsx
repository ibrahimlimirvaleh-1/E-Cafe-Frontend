import { ArrowRight, CalendarDays, Clock3, MapPin, Search, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation, isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
import { ReservationPaymentProofPanel } from '../../features/reservations/ReservationPaymentProofPanel'
import {
  ReservationDateFilter,
} from '../../features/reservations/ReservationDateFilter'

const emptyPage: PaginatedResponse<ReservationResponse> = {
  items: [],
  pageIndex: 1,
  totalPages: 1,
  totalCount: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}

export function MyReservationsPage() {
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setRestaurantName(searchInput.trim()), 300)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const query = useMemo(
    () => ({ pageNumber, pageSize, reservedDate: selectedDate, restaurantName }),
    [pageNumber, pageSize, selectedDate, restaurantName],
  )
  const { data, error, isLoading } = useAsyncData(
    () => ecafeApi.reservations.listMine(query),
    emptyPage,
    [query, reloadKey],
  )

  useEffect(() => {
    if (!isLoading && !error && data.totalPages > 0 && pageNumber > data.totalPages) {
      setPageNumber(data.totalPages)
    }
  }, [data.totalPages, error, isLoading, pageNumber])

  const reservationSummary = useMemo(() => {
    const activeCount = data.items.filter((reservation) => getReservationStatusPresentation(reservation.status).tone !== 'danger').length
    const awaitingPaymentCount = data.items.filter((reservation) => isReservationAwaitingPayment(reservation.status)).length

    return {
      activeCount,
      awaitingPaymentCount,
      totalCount: data.totalCount,
    }
  }, [data.items, data.totalCount])

  const hasFilters = Boolean(selectedDate || restaurantName)

  function clearFilters() {
    setSearchInput('')
    setRestaurantName('')
    setSelectedDate('')
    setPageNumber(1)
  }

  return (
    <main className="page reservations-page">
      <PageHeader
        eyebrow="Hesab"
        title="Rezervasiyalarım"
        description="Rezervasiyalarınızı və ödəniş mərhələlərini izləyin."
      />

      <section className="reservation-list-toolbar" aria-label="Rezervasiya filterləri">
        <div className="reservation-name-filter">
          <label htmlFor="my-reservations-restaurant-name">Restoran adı</label>
          <div className="reservation-name-filter-control">
            <Search aria-hidden="true" size={18} />
            <input
              autoComplete="off"
              id="my-reservations-restaurant-name"
              maxLength={100}
              onChange={(event) => {
                setSearchInput(event.target.value)
                setPageNumber(1)
              }}
              placeholder="Restoran axtar"
              type="search"
              value={searchInput}
            />
            {searchInput ? (
              <button
                aria-label="Restoran axtarışını təmizlə"
                onClick={() => {
                  setSearchInput('')
                  setRestaurantName('')
                  setPageNumber(1)
                }}
                title="Axtarışı təmizlə"
                type="button"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </div>
        <ReservationDateFilter value={selectedDate} onChange={(value) => {
          setSelectedDate(value)
          setPageNumber(1)
        }} />
      </section>

      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {isLoading ? <p className="online-only">Rezervasiyalar yüklənir...</p> : null}

      {!isLoading && !error && data.items.length > 0 ? (
        <section className="reservation-overview" aria-label="Rezervasiya xülasəsi">
          <div>
            <span>Bu səhifədə aktiv</span>
            <strong>{reservationSummary.activeCount}</strong>
            <small>rezervasiya</small>
          </div>
          <div>
            <span>Bu səhifədə ödəniş gözləyir</span>
            <strong>{reservationSummary.awaitingPaymentCount}</strong>
            <small>növbəti addım</small>
          </div>
          <div>
            <span>Tapılan</span>
            <strong>{reservationSummary.totalCount}</strong>
            <small>rezervasiya</small>
          </div>
        </section>
      ) : null}

      {!isLoading && !error && data.items.length === 0 ? (
        <section className="reservation-empty-state">
          <CalendarDays size={28} />
          <h2>{hasFilters ? 'Axtarışa uyğun rezervasiya yoxdur' : 'Hələ rezervasiyanız yoxdur'}</h2>
          <p>{hasFilters ? 'Restoran adını və ya tarixi dəyişərək yenidən yoxlayın.' : 'Restoran seçərək uyğun masa üçün rezervasiya yarada bilərsiniz.'}</p>
          {hasFilters ? <Button onClick={clearFilters} variant="secondary">Filtrləri təmizlə</Button> : <ButtonLink to="/">Restoranlara bax</ButtonLink>}
        </section>
      ) : null}

      <section className="customer-reservation-list" aria-label="Rezervasiya siyahısı">
        {data.items.map((reservation) => {
          const presentation = getReservationStatusPresentation(reservation.status)

          return (
            <article className="customer-reservation-card" key={reservation.id}>
              <div className="customer-reservation-card-header">
                <div>
                  <span className="reservation-card-kicker">Rezervasiya #{reservation.id}</span>
                  <h2>{reservation.restaurantName || 'Restoran rezervasiyası'}</h2>
                </div>
                <div className="reservation-card-status">
                  <Badge tone={presentation.tone}>{presentation.label}</Badge>
                  <span>{reservation.expectedArrivalAt ? 'Yeni gəliş: ' : ''}{formatReservationDateTime(reservation.expectedArrivalAt || reservation.reservedAt)}</span>
                </div>
              </div>

              <div className="customer-reservation-meta">
                <span className="reservation-meta-item"><CalendarDays size={17} /><span><small>Gəliş vaxtı</small><b>{formatReservationDateTime(reservation.reservedAt)}</b></span></span>
                <span className="reservation-meta-item"><MapPin size={17} /><span><small>Masa</small><b>{reservation.tableName || `Masa ${reservation.tableId}`}</b></span></span>
                <span className="reservation-meta-item"><Users size={17} /><span><small>Qonaq sayı</small><b>{reservation.peopleCount} nəfər</b></span></span>
                <span className="reservation-meta-item"><Clock3 size={17} /><span><small>Depozit</small><b>{reservation.depositAmount > 0 ? `${reservation.depositAmount.toFixed(2)} AZN` : 'Tələb olunmur'}</b></span></span>
              </div>

              {reservation.latestPaymentInstruction ? (
                <div className="reservation-payment-note">
                  <strong>Ödəniş məlumatı</strong>
                  <p role={reservation.latestPaymentInstruction.isDetailsAvailable ? undefined : 'alert'}>
                    {reservation.latestPaymentInstruction.isDetailsAvailable
                      ? reservation.latestPaymentInstruction.maskedDetails || 'Detallara baxın'
                      : 'Ödəniş məlumatı əlçatan deyil. Restoranla əlaqə saxlayın.'}
                  </p>
                  <small>{formatReservationDateTime(reservation.latestPaymentInstruction.sentAt)}</small>
                </div>
              ) : null}

              {reservation.latestPaymentInstruction?.isDetailsAvailable && isReservationAwaitingPayment(reservation.status) ? (
                <ReservationPaymentProofPanel
                  restaurantId={String(reservation.restaurantId)}
                  reservationId={String(reservation.id)}
                  amount={reservation.latestPaymentInstruction.amount || reservation.depositAmount}
                  statusId={reservation.statusId}
                  workflowFlowCode={reservation.workflowFlowCode}
                  onSubmitted={() => setReloadKey((value) => value + 1)}
                />
              ) : null}

              <div className="customer-reservation-card-footer">
                <span className="reservation-card-deadline">
                  {reservation.holdExpiresAt
                    ? `Ödəniş üçün son vaxt: ${formatReservationDateTime(reservation.holdExpiresAt)}`
                    : reservation.restaurantResponseExpiresAt
                      ? `Cavab üçün son vaxt: ${formatReservationDateTime(reservation.restaurantResponseExpiresAt)}`
                      : 'Rezervasiya məlumatları yenilənir'}
                </span>
                <ButtonLink variant="secondary" to={`/confirmation?reservationId=${reservation.id}`}>
                  Detallara bax <ArrowRight size={16} />
                </ButtonLink>
              </div>
            </article>
          )
        })}
      </section>
      {!isLoading && !error ? (
        <PaginationControls
          ariaLabel="Rezervasiyalarım səhifələməsi"
          hasNextPage={data.hasNextPage}
          hasPreviousPage={data.hasPreviousPage}
          pageIndex={data.pageIndex}
          pageSize={pageSize}
          showOnSinglePage
          totalCount={data.totalCount}
          totalPages={data.totalPages}
          onPageChange={setPageNumber}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPageNumber(1)
          }}
        />
      ) : null}
    </main>
  )
}
