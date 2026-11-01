export type OrderChangedPayload = {
  eventId: string
  restaurantId: number
  tableSessionId: number | null
  orderId: number | null
  occurredAtUtc: string
}

export const ORDER_CHANGED_EVENT = 'ecafe:orders-changed'
export const ORDER_SYNC_EVENT = 'ecafe:orders-sync'

const recentIds = new Set<string>()
const maxRecentIds = 256
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseOrderChanged(payload: unknown): OrderChangedPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const value = payload as Partial<OrderChangedPayload>
  if (typeof value.eventId !== 'string' || !guid.test(value.eventId) ||
    !Number.isSafeInteger(value.restaurantId) || Number(value.restaurantId) <= 0 ||
    value.tableSessionId !== null && (!Number.isSafeInteger(value.tableSessionId) || Number(value.tableSessionId) <= 0) ||
    value.orderId !== null && (!Number.isSafeInteger(value.orderId) || Number(value.orderId) <= 0) ||
    typeof value.occurredAtUtc !== 'string' || !Number.isFinite(Date.parse(value.occurredAtUtc))) return null
  return value as OrderChangedPayload
}

export function dispatchOrderChanged(payload: unknown) {
  const event = parseOrderChanged(payload)
  if (!event || recentIds.has(event.eventId)) return
  recentIds.add(event.eventId)
  if (recentIds.size > maxRecentIds) recentIds.delete(recentIds.values().next().value!)
  window.dispatchEvent(new CustomEvent<OrderChangedPayload>(ORDER_CHANGED_EVENT, { detail: event }))
}

export function dispatchOrderSync() {
  window.dispatchEvent(new Event(ORDER_SYNC_EVENT))
}

export function matchesOrderScope(payload: OrderChangedPayload, restaurantId: string, tableSessionId?: number | null) {
  return String(payload.restaurantId) === restaurantId &&
    (tableSessionId == null || payload.tableSessionId == null || payload.tableSessionId === tableSessionId)
}
