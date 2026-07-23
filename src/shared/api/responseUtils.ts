export type AnyRecord = Record<string, unknown>

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (value && typeof value === 'object') {
    const record = value as AnyRecord
    const candidates = [record.items, record.records, record.result, record.values]
    const array = candidates.find(Array.isArray)
    if (array) {
      return array as T[]
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
