import { MapPin, Phone, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'
import { PageHeader } from '../../shared/ui/PageHeader'

export function RestaurantCatalogPage() {
  const restaurants = ecafeApi.restaurants.list()

  return (
    <main className="page">
      <PageHeader
        eyebrow="Public kataloq"
        title="Restoran seç və depozitli rezervasiya et"
        description="Uyğun restoranı tap, masa və ofisiant seç, rezervasiyanı online depozitlə təsdiqlə."
      />

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
