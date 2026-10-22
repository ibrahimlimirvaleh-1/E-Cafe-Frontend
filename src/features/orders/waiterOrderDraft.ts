import type { MenuItem } from '../../entities/types'

export type WaiterDraftLine = { item: MenuItem; quantity: number; note: string }
export type WaiterOrderDraft = { cart: WaiterDraftLine[]; note: string }

const maxAgeMs = 7 * 24 * 60 * 60 * 1000

export function waiterOrderDraftKey(userId: string, restaurantId: string, sessionId: number) {
  return `ecafe.waiter.order-draft.v1:${userId}:${restaurantId}:${sessionId}`
}

export function readWaiterOrderDraft(key: string): WaiterOrderDraft {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { cart: [], note: '' }
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return { cart: [], note: '' }
    const draft = value as { cart?: unknown; note?: unknown; updatedAt?: unknown }
    if (typeof draft.updatedAt !== 'number' || Date.now() - draft.updatedAt > maxAgeMs ||
      !Array.isArray(draft.cart) || draft.cart.length > 100 || typeof draft.note !== 'string' || draft.note.length > 1000) {
      return { cart: [], note: '' }
    }
    const cart = draft.cart.filter((line): line is WaiterDraftLine => {
      if (!line || typeof line !== 'object') return false
      const entry = line as Partial<WaiterDraftLine>
      const item = entry.item
      return Boolean(item && typeof item.id === 'string' && Number.isSafeInteger(Number(item.id)) &&
        typeof item.name === 'string' && typeof item.price === 'number' && Number.isFinite(item.price) &&
        Number.isInteger(entry.quantity) && entry.quantity! >= 1 && entry.quantity! <= 100 &&
        typeof entry.note === 'string' && entry.note.length <= 500)
    })
    return { cart, note: draft.note }
  } catch {
    return { cart: [], note: '' }
  }
}

export function saveWaiterOrderDraft(key: string, draft: WaiterOrderDraft) {
  if (!draft.cart.length && !draft.note.trim()) window.localStorage.removeItem(key)
  else window.localStorage.setItem(key, JSON.stringify({ ...draft, updatedAt: Date.now() }))
}

export function clearWaiterOrderDraft(key: string) {
  try { window.localStorage.removeItem(key) } catch { /* The confirmed order must not be retried as a draft. */ }
}
