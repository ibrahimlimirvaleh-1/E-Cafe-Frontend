import type { CreateSessionOrderRequest } from '../../shared/api/ecafeApi'
import type { WaiterDraftLine } from './waiterOrderDraft'

export function buildOrderBody(cart: WaiterDraftLine[], note: string): CreateSessionOrderRequest {
  const trimmedNote = note.trim()
  return {
    ...(trimmedNote ? { note: trimmedNote } : {}),
    items: cart.map((line) => ({
      itemId: Number(line.item.id),
      quantity: line.quantity,
      ...(line.note.trim() ? { note: line.note.trim() } : {}),
      expectedUnitPrice: line.item.price,
    })),
  }
}

export function validateOrderCart(cart: WaiterDraftLine[], note: string) {
  if (cart.length === 0) return 'empty'
  if (cart.length > 100 || note.trim().length > 1000 || cart.some((line) =>
    !Number.isSafeInteger(Number(line.item.id)) || line.quantity < 1 || line.quantity > 100 ||
    line.note.trim().length > 500)) return 'invalid'
  return null
}
