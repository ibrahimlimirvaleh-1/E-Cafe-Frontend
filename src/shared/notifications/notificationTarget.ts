import type { NotificationItem } from '../../entities/types'
import { RoleIds, isInRole } from '../auth/authz'
import type { CurrentUser } from '../auth/jwt'
import { canAccessAdminModule } from '../config/adminPermissions'

function parsePayload(payloadJson?: string) {
  if (!payloadJson) {
    return {} as Record<string, unknown>
  }

  try {
    return JSON.parse(payloadJson) as Record<string, unknown>
  } catch {
    return {}
  }
}

function valueAsString(value: unknown) {
  return value == null ? '' : String(value)
}

function buildContractTarget(contractId: string, restaurantId: string) {
  const query = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
  return `/admin/contracts/${encodeURIComponent(contractId)}${query}`
}

export function getNotificationTarget(notification: NotificationItem, user?: CurrentUser | null) {
  const payload = parsePayload(notification.payloadJson)
  const relatedType = `${notification.relatedEntityType || ''} ${notification.typeName || ''}`.toLowerCase()
  const contractId =
    valueAsString(payload.contractId || payload.ContractId) ||
    (relatedType.includes('contract') ? valueAsString(notification.relatedEntityId) : '')
  const restaurantId = valueAsString(payload.restaurantId || payload.RestaurantId || notification.restaurantId)

  if (contractId && canAccessAdminModule(user, 'contracts', restaurantId)) {
    return buildContractTarget(contractId, restaurantId)
  }

  if (relatedType.includes('order')) {
    if (isInRole(user, [RoleIds.Kitchen], restaurantId)) {
      return '/kitchen'
    }

    if (isInRole(user, [RoleIds.Waiter], restaurantId)) {
      return '/waiter/orders'
    }

    return '/admin/orders'
  }

  if (relatedType.includes('reservation')) {
    return '/admin/reservations'
  }

  if (restaurantId && canAccessAdminModule(user, 'restaurants', restaurantId)) {
    return `/admin/restaurants/${encodeURIComponent(restaurantId)}`
  }

  return ''
}
