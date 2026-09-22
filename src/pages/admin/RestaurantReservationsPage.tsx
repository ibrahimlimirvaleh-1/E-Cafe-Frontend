import { ArrowRight, CalendarDays, Clock3, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { getAccessibleItems } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { RestaurantSelectField } from '../../shared/ui/RestaurantSelectField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'

const defaultPageSize = 20

const emptyPage: PaginatedResponse<ReservationResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasPreviousPage: false, hasNextPage: false,
}

export function RestaurantReservationsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const restaurantId = accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId)
    ? selectedRestaurantId
    : accessibleRestaurants[0]?.id || ''
  const query = useMemo(() => ({ pageNumber, pageSize }), [pageNumber, pageSize])
  const { data, error, isLoading } = useAsyncData(
    () => restaurantId ? ecafeApi.reservations.listForRestaurant(restaurantId, query) : Promise.resolve(emptyPage),
    emptyPage,
    [restaurantId, query],
  )

  useEffect(() => {
    const restaurantIdFromUrl = searchParams.get('restaurantId')
    if (!selectedRestaurantId && restaurantIdFromUrl && accessibleRestaurants.some((restaurant) => restaurant.id === restaurantIdFromUrl)) {
      setSelectedRestaurantId(restaurantIdFromUrl)
    }
  }, [accessibleRestaurants, searchParams, selectedRestaurantId])

  useEffect(() => {
    setPageNumber(1)
  }, [restaurantId])

  function handleRestaurantChange(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    setPageNumber(1)
  }

  return (
    <main className="admin-page reservations-admin-page">
      <PageHeader
        eyebrow="Restoran"
        title="Rezervasiyalar"
        description="Müştərilərin rezervasiyalarını və ödəniş gözləyən sorğuları idarə edin."
      />

      <section className="admin-panel reservation-admin-toolbar">
        <RestaurantSelectField
          emptyOption={null}
          label="Restoran"
          onChange={handleRestaurantChange}
          required
          restaurants={accessibleRestaurants}
          value={restaurantId}
        />
      </section>

      {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>Rezervasiyaları görmək üçün restoran seçin.</StatusMessage> : null}
      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {isLoading ? <p className="online-only">Rezervasiyalar yüklənir...</p> : null}

      {!isLoading && !error && data.items.length === 0 ? (
        <section className="reservation-empty-state reservation-empty-state-admin">
          <CalendarDays size={28} />
          <h2>Rezervasiya yoxdur</h2>
          <p>Bu restoran üçün yeni rezervasiya yarandıqda burada görünəcək.</p>
        </section>
      ) : null}

      {!isLoading && !error && restaurantId ? (
        <>
          <section className="admin-reservation-list" aria-label="Restoran rezervasiyaları">
            {data.items.map((reservation) => {
              const presentation = getReservationStatusPresentation(reservation.status)

              return (
                <article className="admin-reservation-row" key={reservation.id}>
                  <div className="admin-reservation-row-main">
                    <span className="reservation-card-kicker">Rezervasiya #{reservation.id}</span>
                    <h2>{reservation.customerName || 'Müştəri'}</h2>
                    <span className="admin-reservation-secondary">{reservation.tableName || `Masa ${reservation.tableId}`}</span>
                  </div>
                  <div className="admin-reservation-row-meta">
                    <span><CalendarDays size={16} />{formatReservationDateTime(reservation.reservedAt)}</span>
                    <span><Users size={16} />{reservation.peopleCount} nəfər</span>
                    <span><Clock3 size={16} />{reservation.depositAmount.toFixed(2)} AZN</span>
                  </div>
                  <div className="admin-reservation-row-action">
                    <Badge tone={presentation.tone}>{presentation.label}</Badge>
                    <ButtonLink variant="secondary" to={`/admin/reservations/${reservation.id}?restaurantId=${restaurantId}`}>
                      Detal <ArrowRight size={16} />
                    </ButtonLink>
                  </div>
                </article>
              )
            })}
          </section>
          <PaginationControls
            ariaLabel="Rezervasiyalar səhifələməsi"
            hasNextPage={data.hasNextPage}
            hasPreviousPage={data.hasPreviousPage}
            pageIndex={data.pageIndex}
            pageSize={pageSize}
            totalCount={data.totalCount}
            totalPages={data.totalPages}
            onPageChange={setPageNumber}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPageNumber(1)
            }}
          />
        </>
      ) : null}
    </main>
  )
}
