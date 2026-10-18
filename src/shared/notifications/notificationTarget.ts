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
  const payloadRestaurantId = valueAsString(payload.restaurantId || payload.RestaurantId)
  const notificationRestaurantId = valueAsString(notification.restaurantId)
  const restaurantId = payloadRestaurantId || notificationRestaurantId

  const isSessionCloseReview = notification.typeName?.toLowerCase() === 'tablesessionclosereviewrequired' ||
    (notification.relatedEntityType?.toLowerCase() === 'tablesession' && payload.section === 'session-close-review')
  if (isSessionCloseReview) {
    if (!restaurantId || (notification.restaurantId && valueAsString(notification.restaurantId) !== restaurantId)) return ''
    const sessionId = valueAsString(payload.tableSessionId || payload.TableSessionId || notification.relatedEntityId)
    const reservationId = valueAsString(payload.reservationId || payload.ReservationId)
    if (isInRole(user, [RoleIds.Waiter], restaurantId)) {
      const query = new URLSearchParams({ view: 'tables', restaurantId })
      if (/^[1-9]\d*$/.test(sessionId)) query.set('tableSessionId', sessionId)
      return `/waiter?${query.toString()}`
    }
    if (isInRole(user, [RoleIds.Manager, RoleIds.Owner], restaurantId)) {
      const query = `?restaurantId=${encodeURIComponent(restaurantId)}`
      return /^[1-9]\d*$/.test(reservationId)
        ? `/admin/reservations/${encodeURIComponent(reservationId)}${query}#session-close-review`
        : `/admin/reservations${query}#session-close-review`
    }
    return ''
  }

  if (notification.typeName?.toLowerCase() === 'tablesessionpaid' && notification.relatedEntityType?.toLowerCase() === 'tablesession') {
    if (payloadRestaurantId && notificationRestaurantId && payloadRestaurantId !== notificationRestaurantId) return ''
    const sessionId = valueAsString(payload.tableSessionId || payload.TableSessionId || notification.relatedEntityId)
    if (!/^[1-9]\d*$/.test(sessionId)) return ''
    if (isInRole(user, [RoleIds.Customer])) return `/orders?sessionId=${encodeURIComponent(sessionId)}`
    if (!restaurantId || !/^[1-9]\d*$/.test(restaurantId)) return ''
    if (isInRole(user, [RoleIds.Waiter], restaurantId)) {
      const query = new URLSearchParams({ view: 'tables', restaurantId, tableSessionId: sessionId })
      return `/waiter?${query.toString()}`
    }
    if (isInRole(user, [RoleIds.Manager, RoleIds.Owner], restaurantId)) {
      const reservationId = valueAsString(payload.reservationId || payload.ReservationId)
      const query = `?restaurantId=${encodeURIComponent(restaurantId)}`
      return /^[1-9]\d*$/.test(reservationId)
        ? `/admin/reservations/${encodeURIComponent(reservationId)}${query}#session-close-review`
        : `/admin/reservations${query}`
    }
    return ''
  }

  if (contractId && canAccessAdminModule(user, 'contracts', restaurantId)) {
    return buildContractTarget(contractId, restaurantId)
  }

  if (relatedType.includes('order')) {
    if (payloadRestaurantId && notificationRestaurantId && payloadRestaurantId !== notificationRestaurantId) return ''
    if (isInRole(user, [RoleIds.Kitchen], restaurantId)) {
      return `/kitchen?restaurantId=${encodeURIComponent(restaurantId)}`
    }

    if (isInRole(user, [RoleIds.Waiter], restaurantId)) {
      if (payload.section === 'order-ready' || notification.typeName?.toLowerCase() === 'orderready') {
        const sessionId = valueAsString(payload.tableSessionId || payload.TableSessionId)
        const orderId = valueAsString(payload.orderId || payload.OrderId || notification.relatedEntityId)
        if (!restaurantId || !/^[1-9]\d*$/.test(sessionId) || !/^[1-9]\d*$/.test(orderId)) return ''
        return `/waiter/restaurants/${encodeURIComponent(restaurantId)}/sessions/${encodeURIComponent(sessionId)}/orders?orderId=${encodeURIComponent(orderId)}`
      }
      return '/waiter/orders'
    }

    return canAccessAdminModule(user, 'orders', restaurantId) ? '/admin/orders' : ''
  }

  if (relatedType.includes('reservation')) {
    const reservationId = valueAsString(payload.reservationId || payload.ReservationId || notification.relatedEntityId)
    if (reservationId && payload.section === 'waiting' && isInRole(user, [RoleIds.Waiter], restaurantId)) {
      const query = new URLSearchParams({ waitingOnly: 'true', reservationId })
      if (restaurantId) query.set('restaurantId', restaurantId)
      return `/waiter?${query.toString()}`
    }

    if (reservationId && canAccessAdminModule(user, 'reservations', restaurantId)) {
      const query = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
      const section = payload.section === 'waiting' ? '#waiting' : ''
      return `/admin/reservations/${encodeURIComponent(reservationId)}${query}${section}`
    }

    if (reservationId && isInRole(user, [RoleIds.Customer])) {
      const section = payload.section === 'refund' ? '#refund' : payload.section === 'schedule-offer' ? '#schedule-offer' : payload.section === 'waiting' ? '#waiting' : ''
      return `/confirmation?reservationId=${encodeURIComponent(reservationId)}${section}`
    }

    return '/admin/reservations'
  }

  if (restaurantId && canAccessAdminModule(user, 'restaurants', restaurantId)) {
    if (payload.section === 'schedule-change') return `/admin/restaurants/${encodeURIComponent(restaurantId)}/edit#schedule-change`
    return `/admin/restaurants/${encodeURIComponent(restaurantId)}`
  }

  return ''
}
