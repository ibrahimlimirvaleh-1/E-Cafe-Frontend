import { MapPin, Phone, Search, ShieldCheck, ShieldX, Star, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { SafeImage } from '../../shared/ui/SafeImage'

const defaultPageSize = 10

export function RestaurantCatalogPage() {
  const [search, setSearch] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [mapRestaurant, setMapRestaurant] = useState<Restaurant | null>(null)
  const query = useMemo(() => {
    const params = new URLSearchParams({
      pageNumber: String(pageNumber),
      pageSize: String(pageSize),
    })

    if (search.trim()) {
      params.set('search', search.trim())
    }

    return `?${params.toString()}`
  }, [pageNumber, pageSize, search])

  const { data: restaurantPage, isLoading } = useAsyncData(() => ecafeApi.restaurants.publicPage(query), {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }, [query])

  return (
    <main className="page">
      <PageHeader eyebrow="Restoran kataloqu" title="Restoran seç və rezervasiyaya başla" />

      <section className="catalog-toolbar">
        <label className="site-search catalog-search">
          <Search size={18} />
          <input
            placeholder="Restoran, filial, məkan və ya menyu üzrə axtar..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPageNumber(1)
            }}
          />
        </label>
        <span>{restaurantPage.totalCount} restoran</span>
      </section>

      {isLoading ? <p className="online-only">Restoranlar yüklənir...</p> : null}
      {!isLoading && restaurantPage.items.length === 0 ? <p className="online-only">Axtarışa uyğun restoran tapılmadı.</p> : null}

      <section className="restaurant-grid">
        {restaurantPage.items.map((restaurant) => (
          <article className="restaurant-card" key={restaurant.id}>
            <div className="restaurant-card-media">
              <SafeImage src={restaurant.image} alt={restaurant.name} />
              <div className="restaurant-card-overlay">
                <span className="restaurant-rating">
                  <Star size={15} fill="currentColor" />
                  {restaurant.rating}
                </span>
                <span
                  aria-label={restaurant.hasActiveContract ? 'Aktiv müqavilə' : 'Rezervasiya bağlıdır'}
                  className={restaurant.hasActiveContract ? 'restaurant-availability active' : 'restaurant-availability blocked'}
                  title={restaurant.hasActiveContract ? 'Aktiv müqavilə' : 'Rezervasiya bağlıdır'}
                >
                  {restaurant.hasActiveContract ? <ShieldCheck size={16} /> : <ShieldX size={16} />}
                </span>
              </div>
            </div>
            <div className="restaurant-card-body">
              <div className="card-kicker">
                <strong>{restaurant.depositAmount} ₼ depozit</strong>
              </div>
              <h2>{restaurant.name}</h2>
              <p>{restaurant.cuisine}</p>
              <div className="meta-list">
                <button className="restaurant-location-button" type="button" onClick={() => setMapRestaurant(restaurant)}>
                  <MapPin size={16} />
                  {restaurant.address}
                </button>
                <span>
                  <Phone size={16} />
                  {restaurant.phone}
                </span>
              </div>
              <Link
                className={`ui-button ${restaurant.hasActiveContract ? 'ui-button-primary' : 'ui-button-secondary'}`}
                to={`/restaurants/${restaurant.id}`}
              >
                {restaurant.hasActiveContract ? 'Profilə bax' : 'Profilə bax, rezervasiya bağlıdır'}
              </Link>
            </div>
          </article>
        ))}
      </section>

      <PaginationControls
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
      />

      {mapRestaurant ? <RestaurantMapDialog restaurant={mapRestaurant} onClose={() => setMapRestaurant(null)} /> : null}
    </main>
  )
}

function RestaurantMapDialog({ restaurant, onClose }: { restaurant: Restaurant; onClose: () => void }) {
  const hasCoordinates = restaurant.latitude != null && restaurant.longitude != null
  const mapQuery = hasCoordinates
    ? `${restaurant.latitude},${restaurant.longitude}`
    : `${restaurant.address} ${restaurant.name}`
  const query = encodeURIComponent(mapQuery)

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
          src={`https://maps.google.com/maps?q=${query}&z=${hasCoordinates ? '17' : '15'}&output=embed`}
          title={`${restaurant.name} xəritəsi`}
        />
      </section>
    </div>
  )
}
