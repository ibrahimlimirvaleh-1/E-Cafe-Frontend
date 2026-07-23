import { MapPin, Phone, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'
import { PageHeader } from '../../shared/ui/PageHeader'

export function RestaurantCatalogPage() {
  const { data: restaurants, isLoading } = useAsyncData(() => ecafeApi.restaurants.publicList(), [])

  return (
    <main className="page">
      <PageHeader
        eyebrow="Public kataloq"
        title="Restoran seç və rezervasiyaya başla"
        description="Uyğun restoranı tap, menyuya, stollara və əməkdaşlara bax. Ödəniş hələlik fiziki/offline aparılır."
      />

      {isLoading ? <p className="online-only">Restoranlar yüklənir...</p> : null}
      {!isLoading && restaurants.length === 0 ? <p className="online-only">Aktiv public restoran tapılmadı.</p> : null}

      <section className="restaurant-grid">
        {restaurants.map((restaurant) => (
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
                {restaurant.hasActiveContract ? 'Profilə bax' : 'Profilə bax, booking bağlıdır'}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
