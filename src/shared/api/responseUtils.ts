export type AnyRecord = Record<string, unknown>

export type PaginatedResponse<T> = {
  items: T[]
  pageIndex: number
  totalPages: number
  totalCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (value && typeof value === 'object') {
    const record = value as AnyRecord
    const candidates = [record.data, record.items, record.records, record.result, record.values, record.list]
    const array = candidates.find(Array.isArray)
    if (array) {
      return array as T[]
    }

    const nested = candidates.find((candidate) => candidate && typeof candidate === 'object')
    if (nested) {
      return asArray<T>(nested)
    }
  }

  return []
}

export function str(value: unknown, fallback = '') {
  return value == null ? fallback : String(value)
}

export function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function bool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (value == null) {
    return fallback
  }

  return String(value).toLowerCase() === 'true'
}

export function asPaginated<T>(value: unknown, mapItem: (record: AnyRecord) => T): PaginatedResponse<T> {
  if (value && typeof value === 'object' && 'items' in value) {
    const record = value as AnyRecord
    return {
      items: asArray<AnyRecord>(record.items).map(mapItem),
      pageIndex: num(record.pageIndex, 1),
      totalPages: num(record.totalPages, 1),
      totalCount: num(record.totalCount),
      hasPreviousPage: bool(record.hasPreviousPage),
      hasNextPage: bool(record.hasNextPage),
    }
  }

  const items = asArray<AnyRecord>(value).map(mapItem)
  return {
    items,
    pageIndex: 1,
    totalPages: 1,
    totalCount: items.length,
    hasPreviousPage: false,
    hasNextPage: false,
  }
}
