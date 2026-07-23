import { Clock, MapPin, Phone, ShieldCheck, Star } from 'lucide-react'
import { useParams } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ButtonLink } from '../../shared/ui/Button'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'

export function RestaurantProfilePage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const { data: restaurant } = useAsyncData<Restaurant | null>(() => ecafeApi.restaurants.detail(restaurantId), null, [restaurantId])

  if (!restaurant) {
    return (
      <main className="page">
        <p className="online-only">Restoran profili yüklənir...</p>
      </main>
    )
  }

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
              Rezervasiya qaydaları restoran tərəfindən idarə olunur
            </span>
            <span>
              <ShieldCheck size={18} />
              Ödəniş fiziki/offline
            </span>
          </div>
          <ContractGuardNotice active={restaurant.hasActiveContract} />
          <div className="action-row">
            <ButtonLink to={`/restaurants/${restaurant.id}/tables`}>
              {restaurant.hasActiveContract ? 'Rezervasiyaya başla' : 'Rezervasiya bağlıdır'}
            </ButtonLink>
          </div>
        </article>
      </section>
    </main>
  )
}
