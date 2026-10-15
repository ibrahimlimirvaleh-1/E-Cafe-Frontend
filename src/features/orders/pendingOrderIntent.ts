import type { CreateSessionOrderRequest } from '../../shared/api/ecafeApi'

export type PendingOrderIntent = {
  key: string
  payload: string
  createdAt: number
}

const prefix = 'ecafe.waiterOrderIntent.v1'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Yarımçıq sifariş cəhdini istifadəçi, restoran və sessiya üzrə ayırır.
export function pendingOrderStorageKey(userId: string, restaurantId: string, sessionId: number) {
  return `${prefix}:${userId}:${restaurantId}:${sessionId}`
}

// Saxlanmış məzmunu yoxlayır; başqa və ya zədələnmiş sorğunu təkrar göndərmir.
export function parsePendingOrderIntent(value: string | null): PendingOrderIntent | null {
  if (!value) return null
  try {
    const intent = JSON.parse(value) as PendingOrderIntent
    if (!intent || typeof intent.key !== 'string' || !uuidPattern.test(intent.key) ||
      typeof intent.payload !== 'string' || !Number.isFinite(intent.createdAt)) return null
    const body = JSON.parse(intent.payload) as CreateSessionOrderRequest
    if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100 ||
      (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 1000)) ||
      body.items.some((line) => !Number.isSafeInteger(line.itemId) || line.itemId <= 0 ||
        !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100 ||
        !Number.isFinite(line.expectedUnitPrice) || line.expectedUnitPrice < 0 ||
        (line.note !== undefined && (typeof line.note !== 'string' || line.note.length > 500)))) return null
    return intent
  } catch {
    return null
  }
}

// Təkrar cəhddə eyni UUID və JSON mətnini bərpa edir.
export function readPendingOrderIntent(key: string) {
  try {
    const raw = window.sessionStorage.getItem(key)
    const intent = parsePendingOrderIntent(raw)
    if (raw && !intent) window.sessionStorage.removeItem(key)
    return intent
  } catch {
    return null
  }
}

export function savePendingOrderIntent(key: string, intent: PendingOrderIntent) {
  window.sessionStorage.setItem(key, JSON.stringify(intent))
}

export function clearPendingOrderIntent(key: string) {
  window.sessionStorage.removeItem(key)
}
