import { MapPin, Phone, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'

const pageSize = 6

export function RestaurantCatalogPage() {
  const [search, setSearch] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const query = useMemo(() => {
    const params = new URLSearchParams({
      pageNumber: String(pageNumber),
      pageSize: String(pageSize),
    })

    if (search.trim()) {
      params.set('search', search.trim())
    }

    return `?${params.toString()}`
  }, [pageNumber, search])

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
            <img src={restaurant.image} alt={restaurant.name} />
            <div className="restaurant-card-body">
              <div className="card-kicker">
                <span>
                  <Star size={16} fill="currentColor" />
                  {restaurant.rating}
                </span>
                <strong>{restaurant.depositAmount} ₼ depozit</strong>
              </div>
              <h2>{restaurant.name}</h2>
              <p>{restaurant.cuisine}</p>
              <div className="meta-list">
                <span>
                  <MapPin size={16} />
                  {restaurant.address}
                </span>
                <span>
                  <Phone size={16} />
                  {restaurant.phone}
                </span>
              </div>
              <ContractGuardNotice active={restaurant.hasActiveContract} />
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
        totalPages={restaurantPage.totalPages}
        onPageChange={setPageNumber}
      />
    </main>
  )
}
