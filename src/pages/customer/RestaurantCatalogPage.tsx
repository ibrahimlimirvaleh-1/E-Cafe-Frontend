import { CircleDollarSign, Clock, MapPin, Phone, Search, ShieldCheck, ShieldX, Star, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { createRestaurantMapEmbedUrl } from '../../shared/config/mapConfig'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { SafeImage } from '../../shared/ui/SafeImage'
import { MobileDownloadLink } from '../../features/mobileDownload/MobileDownloadLink'
import { usePublicMobileRelease } from '../../features/mobileDownload/usePublicMobileRelease'
import { formatWorkingHoursSummary, getRestaurantOpenState } from '../../shared/lib/workingHours'
import { getTodayDateInputValue } from '../../shared/lib/dateFormatting'

const defaultPageSize = 10

export function RestaurantCatalogPage() {
  const { user } = useAuth()
  const isCustomer = isInRole(user, [RoleIds.Customer])
  const [search, setSearch] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [mapRestaurant, setMapRestaurant] = useState<Restaurant | null>(null)
  const mobileRelease = usePublicMobileRelease()
  const today = getTodayDateInputValue()
  const query = useMemo(() => {
    const params = new URLSearchParams({
      pageNumber: String(pageNumber),
      pageSize: String(pageSize),
      reservationDate: today,
    })

    if (search.trim()) {
      params.set('search', search.trim())
    }

    return `?${params.toString()}`
  }, [pageNumber, pageSize, search, today])

  const { data: restaurantPage, isLoading } = useAsyncData(() => ecafeApi.restaurants.publicPage(query), {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }, [query])

  return (
    <main className="page restaurant-catalog-page">
      <PageHeader title={isCustomer ? 'Restoran seç və rezervasiyaya başla' : 'Restoranlar'} />

      <section className="catalog-toolbar">
        <label className="site-search catalog-search">
          <Search size={18} />
          <input
            aria-label="Restoran axtar"
            placeholder="Restoran, filial, məkan və ya menyu üzrə axtar..."
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPageNumber(1)
            }}
          />
        </label>
        <MobileDownloadLink release={mobileRelease} />
      </section>

      <div className="catalog-results-count" aria-live="polite">
        {isLoading ? 'Yüklənir...' : `${restaurantPage.totalCount} restoran`}
      </div>

      {isLoading ? <p className="online-only">Restoranlar yüklənir...</p> : null}
      {!isLoading && restaurantPage.items.length === 0 ? <p className="online-only">Axtarışa uyğun restoran tapılmadı.</p> : null}

      <section className="restaurant-grid">
        {!isLoading ? restaurantPage.items.map((restaurant) => {
          const openState = getRestaurantOpenState(restaurant.workingHours, restaurant.timeZone, restaurant.isOpen)
          const profileUrl = `/restaurants/${restaurant.id}`

          return (
            <article className="restaurant-card" key={restaurant.id}>
              <Link className="restaurant-card-media" to={profileUrl} aria-label={`${restaurant.name} restoranına bax`}>
                <SafeImage src={restaurant.image} alt={restaurant.name} />
                <div className="restaurant-card-overlay">
                  <div className="restaurant-overlay-badges">
                    {restaurant.rating > 0 ? (
                      <span className="restaurant-rating">
                        <Star size={15} fill="currentColor" />
                        {restaurant.rating}
                      </span>
                    ) : null}
                    {restaurant.depositAmount !== undefined && restaurant.depositAmount > 0 ? (
                      <span className="restaurant-deposit-badge" title="Bu gün üçün depozit" aria-label={`Bu gün üçün ${restaurant.depositAmount.toFixed(2)} AZN depozit`}>
                        <CircleDollarSign size={15} />
                        Bu gün {restaurant.depositAmount.toFixed(2)} ₼
                      </span>
                    ) : null}
                  </div>
                  <span
                    aria-label={restaurant.hasActiveContract ? 'Aktiv müqavilə' : 'Rezervasiya bağlıdır'}
                    className={restaurant.hasActiveContract ? 'restaurant-availability active' : 'restaurant-availability blocked'}
                    title={restaurant.hasActiveContract ? 'Aktiv müqavilə' : 'Rezervasiya bağlıdır'}
                  >
                    {restaurant.hasActiveContract ? <ShieldCheck size={16} /> : <ShieldX size={16} />}
                  </span>
                </div>
              </Link>
              <div className="restaurant-card-body">
                <div className="restaurant-card-intro">
                  <h2>
                    <Link className="restaurant-title-link" to={profileUrl}>
                      {restaurant.name}
                    </Link>
                  </h2>
                  <p>{restaurant.cuisine}</p>
                </div>
                <button className="restaurant-location-button" type="button" title={restaurant.address} onClick={() => setMapRestaurant(restaurant)}>
                  <MapPin size={16} />
                  <span>{restaurant.address}</span>
                </button>
                <div className="restaurant-card-footer">
                  <span className={openState.isOpen ? 'restaurant-open-status open' : 'restaurant-open-status closed'}>
                    <Clock size={16} />
                    <span>{openState.isOpen ? 'Hazırda açıq' : 'Hazırda bağlı'}</span>
                  </span>
                  <span className="restaurant-hours">
                    <Clock size={16} />
                    <span>{formatWorkingHoursSummary(restaurant.workingHours, restaurant.timeZone, restaurant.todayWorkingHours)}</span>
                  </span>
                  <a className="restaurant-phone" href={`tel:${restaurant.phone}`}>
                    <Phone size={16} />
                    <span>{restaurant.phone}</span>
                  </a>
                </div>
              </div>
            </article>
          )
        }) : null}
      </section>

      {!isLoading ? <PaginationControls
        ariaLabel="Restoran səhifələmə"
        hasNextPage={restaurantPage.hasNextPage}
        hasPreviousPage={restaurantPage.hasPreviousPage}
        pageIndex={restaurantPage.pageIndex}
        pageSize={pageSize}
        totalCount={restaurantPage.totalCount}
        totalPages={restaurantPage.totalPages}
        onPageChange={setPageNumber}
        onPageSizeChange={(value) => {
          setPageSize(value)
          setPageNumber(1)
        }}
      /> : null}

      {mapRestaurant ? <RestaurantMapDialog restaurant={mapRestaurant} onClose={() => setMapRestaurant(null)} /> : null}
    </main>
  )
}

function RestaurantMapDialog({ restaurant, onClose }: { restaurant: Restaurant; onClose: () => void }) {
  const mapUrl = createRestaurantMapEmbedUrl(restaurant)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="map-dialog" role="dialog" aria-modal="true" aria-label={`${restaurant.name} xəritəsi`} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">Məkan</span>
            <h2>{restaurant.name}</h2>
            <p>{restaurant.address}</p>
          </div>
          <button aria-label="Xəritəni bağla" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <iframe
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapUrl}
          title={`${restaurant.name} xəritəsi`}
        />
      </section>
    </div>
  )
}
