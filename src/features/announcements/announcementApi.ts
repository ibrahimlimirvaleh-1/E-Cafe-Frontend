import { httpClient } from '../../shared/api/httpClient'

export const destinationRoles = {
  CustomerProfile: [5], CustomerReservations: [5], CustomerOrders: [5], WaiterTables: [4], KitchenOrders: [6],
  Inventory: [1, 2, 3], DashboardReports: [1, 2, 3], AnnouncementAdmin: [1],
} as const
export type Destination = keyof typeof destinationRoles
export type Announcement = { id: number; version: number; title: string; body: string; destination: Destination; publishedAtUtc: string }
export type PendingAnnouncements = { roleId: number; restaurantId: number | null; items: Announcement[]; hasMore: boolean }
export type AnnouncementText = { language: 'az' | 'en' | 'ru'; title: string; body: string }
export type AdminAnnouncement = { id: number; version: number; destination: Destination; roleIds: number[]; texts: AnnouncementText[]; createdAtUtc: string; updatedAtUtc: string | null; publishedAtUtc: string | null; expiresAtUtc: string | null; isPublished: boolean }
export type AnnouncementDraft = Pick<AdminAnnouncement, 'destination' | 'roleIds' | 'texts' | 'expiresAtUtc'>
const options = { skipAuthRefresh: true, suppressAuthExpiredEvent: true, sessionEffects: 'none' as const }
const positive = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0
const object = (x: unknown): Record<string, unknown> => { if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Invalid announcement response'); return x as Record<string, unknown> }
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0
const date = (x: unknown): x is string => typeof x === 'string' && !Number.isNaN(Date.parse(x))
export const isDestination = (x: unknown): x is Destination => typeof x === 'string' && Object.hasOwn(destinationRoles, x)
function roleIds(x: unknown): x is number[] { return Array.isArray(x) && x.length > 0 && x.every(r => positive(r) && r <= 6) && new Set(x).size === x.length }
function validItem(x: unknown): Announcement {
  const r = object(x)
  if (!positive(r.id) || !positive(r.version) || !text(r.title) || r.title.length > 120 || !text(r.body) || r.body.length > 600 || /<\/?[a-z][^>]*>/i.test(r.title + r.body) || !isDestination(r.destination) || !date(r.publishedAtUtc)) throw new Error('Invalid announcement item')
  return r as Announcement
}
export function parsePending(x: unknown): PendingAnnouncements {
  const r = object(x)
  if (!positive(r.roleId) || r.roleId > 6 || !(r.restaurantId === null || positive(r.restaurantId)) || !Array.isArray(r.items) || r.items.length > 3 || typeof r.hasMore !== 'boolean') throw new Error('Invalid pending announcements')
  const items = r.items.map(validItem)
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => !(destinationRoles[item.destination] as readonly number[]).includes(r.roleId as number))) throw new Error('Invalid announcement audience')
  return { roleId: r.roleId, restaurantId: r.restaurantId, hasMore: r.hasMore, items }
}
function parseAdmin(x: unknown): AdminAnnouncement {
  const r = object(x)
  if (!positive(r.id) || !positive(r.version) || !isDestination(r.destination) || !roleIds(r.roleIds) || r.roleIds.some(role => !(destinationRoles[r.destination as Destination] as readonly number[]).includes(role)) || !Array.isArray(r.texts) || r.texts.length !== 3 || typeof r.isPublished !== 'boolean' || !date(r.createdAtUtc) || !(r.updatedAtUtc === null || date(r.updatedAtUtc)) || !(r.publishedAtUtc === null || date(r.publishedAtUtc)) || !(r.expiresAtUtc === null || date(r.expiresAtUtc))) throw new Error('Invalid admin announcement')
  const texts = r.texts.map(object)
  if (new Set(texts.map(t => t.language)).size !== 3 || texts.some(t => !['az', 'en', 'ru'].includes(String(t.language)) || typeof t.title !== 'string' || t.title.length > 120 || typeof t.body !== 'string' || t.body.length > 600 || (r.isPublished && (!text(t.title) || !text(t.body))))) throw new Error('Invalid announcement translations')
  return r as AdminAnnouncement
}
async function request(path: string, signal?: AbortSignal, body?: unknown, method = 'GET') {
  const result = await httpClient<unknown>(path, { ...options, signal, method, cache: 'no-store', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  if (result.success === false) throw new Error('Announcement request rejected')
  return result
}
export const announcementApi = {
  pending: async (signal: AbortSignal) => parsePending((await request('/announcements/pending', signal)).data),
  acknowledge: async (id: number, version: number, signal: AbortSignal) => {
    if (!positive(id) || !positive(version)) throw new Error('Invalid receipt')
    if ((await request(`/announcements/${id}/acknowledge`, signal, { version }, 'POST')).statusCode !== 204) throw new Error('Unknown receipt result')
  },
  list: async (beforeId?: number, signal?: AbortSignal) => {
    const r = object((await request(`/admin/announcements${beforeId ? `?beforeId=${beforeId}` : ''}`, signal)).data)
    if (!Array.isArray(r.items) || typeof r.hasMore !== 'boolean' || !(r.nextBeforeId === null || positive(r.nextBeforeId))) throw new Error('Invalid announcement page')
    const items = r.items.map(parseAdmin)
    if (new Set(items.map(item => item.id)).size !== items.length || (r.hasMore && (!positive(r.nextBeforeId) || (beforeId && r.nextBeforeId >= beforeId)))) throw new Error('Invalid announcement cursor')
    return { items, hasMore: r.hasMore, nextBeforeId: r.nextBeforeId as number | null }
  },
  destinations: async (signal?: AbortSignal) => {
    const data = (await request('/admin/announcements/destinations', signal)).data
    if (!Array.isArray(data)) throw new Error('Invalid destinations')
    const rows = data.map(object)
    if (new Set(rows.map(r => r.key)).size !== rows.length || rows.some(r => !isDestination(r.key) || !roleIds(r.roleIds) || r.roleIds.some(role => !(destinationRoles[r.key as Destination] as readonly number[]).includes(role)))) throw new Error('Invalid destination capabilities')
    return rows as { key: Destination; roleIds: number[] }[]
  },
  save: async (draft: AnnouncementDraft, existing?: AdminAnnouncement, signal?: AbortSignal) => parseAdmin((await request(existing ? `/admin/announcements/${existing.id}` : '/admin/announcements', signal, { ...draft, ...(existing ? { expectedVersion: existing.version } : {}) }, existing ? 'PUT' : 'POST')).data),
  publish: async (item: AdminAnnouncement, published: boolean, signal?: AbortSignal) => parseAdmin((await request(`/admin/announcements/${item.id}/${published ? 'publish' : 'unpublish'}`, signal, { expectedVersion: item.version }, 'POST')).data),
}

export function announcementTarget(destination: Destination, roleId: number, restaurantId: number | null) {
  if (!(destinationRoles[destination] as readonly number[]).includes(roleId)) return ''
  const scope = restaurantId ? `?restaurantId=${restaurantId}` : ''
  switch (destination) {
    case 'CustomerProfile': return '/account'
    case 'CustomerReservations': return '/reservations'
    case 'CustomerOrders': return '/orders'
    case 'WaiterTables': return `/waiter?view=tables${restaurantId ? `&restaurantId=${restaurantId}` : ''}`
    case 'KitchenOrders': return `/kitchen${scope}`
    case 'Inventory': return `/admin/inventory${scope}`
    case 'DashboardReports': return `/admin?view=reports${restaurantId ? `&restaurantId=${restaurantId}` : ''}`
    case 'AnnouncementAdmin': return '/admin/announcements'
  }
}
