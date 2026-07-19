import { ChevronRight, Menu as MenuIcon, Search, Star } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { restaurants } from '../../data/mockData'

export function RestaurantCatalog() {
  return (
    <section className="page customer-home">
      <div className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Bakıda ağıllı restoran rezervasiyası</span>
          <h1>Restoran seç, masa ayır, menyunu əvvəlcədən sifariş et.</h1>
          <p>
            ECafe müştəri, restoran sahibi və ofisiant üçün vahid rezervasiya,
            pre-order və Payriff ödəniş axını yaradır.
          </p>
          <div className="hero-actions">
            <NavLink className="primary-button" to="/restaurants/saffron-premium">
              Rezervasiyaya başla
              <ChevronRight size={18} />
            </NavLink>
            <NavLink className="secondary-button" to="/admin">
              Admin panelə bax
            </NavLink>
          </div>
        </div>
        <div className="reservation-card">
          <div className="card-header">
            <span>Bu gün</span>
            <strong>20:30</strong>
          </div>
          <div className="mini-grid">
            <span>2 nəfər</span>
            <span>VIP zal</span>
            <span>Pre-order</span>
            <span>Payriff</span>
          </div>
          <p>Saffron Premium Lounge üçün sürətli təsdiq gözlənilir.</p>
        </div>
      </div>

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input placeholder="Restoran, mətbəx və ya rayon axtar" />
        </label>
        <button className="filter-button" type="button">
          <MenuIcon size={18} />
          Filter
        </button>
      </div>

      <div className="restaurant-grid">
        {restaurants.map((restaurant) => (
          <article className="restaurant-card" key={restaurant.id}>
            <img src={restaurant.image} alt={restaurant.name} />
            <div className="restaurant-content">
              <div>
                <span className="rating">
                  <Star size={16} fill="currentColor" />
                  {restaurant.rating}
                </span>
                <h2>{restaurant.name}</h2>
                <p>{restaurant.cuisine}</p>
              </div>
              <div className="tag-row">
                {restaurant.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="card-footer">
                <span>{restaurant.area}</span>
                <NavLink to={`/restaurants/${restaurant.id}`}>Detallara bax</NavLink>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
