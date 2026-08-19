import type { Restaurant } from '../../entities/types'
import { Badge } from './Badge'
import { SafeImage } from './SafeImage'

type RestaurantContextCardProps = {
  restaurant?: Restaurant
}

export function restaurantOptionLabel(restaurant: Restaurant) {
  return [restaurant.name, restaurant.branchName, restaurant.address].filter(Boolean).join(' - ')
}

export function RestaurantContextCard({ restaurant }: RestaurantContextCardProps) {
  if (!restaurant) {
    return null
  }

  return (
    <article className="restaurant-context-card">
      <SafeImage src={restaurant.image} alt={restaurant.name} />
      <div>
        <strong>{restaurant.name}</strong>
        <span>{restaurant.restaurantGroupName || 'Restoran qrupu yoxdur'} - {restaurant.branchName || restaurant.address}</span>
        <small>{restaurant.address} - {restaurant.phone}</small>
      </div>
      <div className="restaurant-context-meta">
        <Badge tone={restaurant.hasActiveContract ? 'success' : 'warning'}>
          {restaurant.hasActiveContract ? 'Aktiv müqavilə' : 'Müqavilə yoxdur'}
        </Badge>
        <small>{restaurant.depositAmount.toFixed(2)} AZN depozit</small>
      </div>
    </article>
  )
}
