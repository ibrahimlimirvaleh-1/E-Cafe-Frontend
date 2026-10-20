import { i18n } from '../i18n/i18n'
import { useTranslation } from 'react-i18next'
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
  useTranslation()
  if (!restaurant) {
    return null
  }

  return (
    <article className="restaurant-context-card">
      <SafeImage src={restaurant.image} alt={restaurant.name} />
      <div>
        <strong>{restaurant.name}</strong>
        <span>{[restaurant.restaurantGroupName || i18n.t('ui.adminFlow.noRestaurantGroup'), restaurant.branchName || restaurant.address].filter(Boolean).join(' · ')}</span>
        <small>{[restaurant.address, restaurant.phone].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="restaurant-context-meta">
        <Badge tone={restaurant.hasActiveContract ? 'success' : 'warning'}>
          {restaurant.hasActiveContract ?i18n.t('ui.shared.ui.restaurant_context_card.aktiv_muqavile_31dcc9') :i18n.t('ui.shared.ui.restaurant_context_card.muqavile_yoxdur_649c6c')}
        </Badge>
      </div>
    </article>
  )
}
