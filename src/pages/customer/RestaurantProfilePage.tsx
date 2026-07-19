import { Clock, MapPin, Phone, ShieldCheck, Star } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { ButtonLink } from '../../shared/ui/Button'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'

export function RestaurantProfilePage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const restaurant = ecafeApi.restaurants.detail(restaurantId)

  return (
    <main className="page">
      <section className="profile-layout">
        <img src={restaurant.image} alt={restaurant.name} />
        <article className="profile-panel">
          <span className="eyebrow">Restoran profili</span>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.cuisine}</p>
          <div className="profile-facts">
            <span>
              <Star size={18} fill="currentColor" />
              {restaurant.rating} reytinq
            </span>
            <span>
              <MapPin size={18} />
              {restaurant.address}
            </span>
            <span>
              <Phone size={18} />
              {restaurant.phone}
            </span>
            <span>
              <Clock size={18} />
              60 dəq ləğv pəncərəsi
            </span>
            <span>
              <ShieldCheck size={18} />
              Online-only payment
            </span>
          </div>
          <ContractGuardNotice active={restaurant.hasActiveContract} />
          <div className="action-row">
            <ButtonLink to={`/restaurants/${restaurant.id}/tables`}>
              {restaurant.hasActiveContract ? 'Rezervasiyaya başla' : 'Booking bağlıdır'}
            </ButtonLink>
            <ButtonLink variant="secondary" to="/pages/restoran_profili">
              Stitch preview
            </ButtonLink>
          </div>
        </article>
      </section>
    </main>
  )
}
