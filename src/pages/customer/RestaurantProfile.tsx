import { ChevronRight, Star } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Stepper } from '../../components/Stepper'
import { restaurants } from '../../data/mockData'

export function RestaurantProfile() {
  const restaurant = restaurants[0]

  return (
    <section className="page detail-page">
      <Stepper active={0} />
      <div className="profile-hero">
        <img src={restaurant.image} alt={restaurant.name} />
        <div className="profile-panel">
          <span className="eyebrow">Restoran profili</span>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.cuisine}. Masa, ofisiant və pre-order seçimini bir axında tamamla.</p>
          <div className="profile-stats">
            <span>
              <Star size={18} fill="currentColor" />
              {restaurant.rating}
            </span>
            <span>{restaurant.area}</span>
            <span>{restaurant.price}</span>
          </div>
          <NavLink className="primary-button" to="/reserve/table">
            Masa seç
            <ChevronRight size={18} />
          </NavLink>
        </div>
      </div>
    </section>
  )
}
