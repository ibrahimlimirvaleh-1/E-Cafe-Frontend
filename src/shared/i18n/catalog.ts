import { i18n } from './i18n'
import { getCurrentLanguage } from './i18n'
import type { Language } from './language'

type Dictionary = { language: Language; version: string; fallbackLanguage: 'az'; messages: Record<string, string> }
type CachedDictionary = Dictionary & { etag: string | null; checkedAt: number }

const cachePrefix = 'ecafe.dictionary.'
const refreshAfterMs = 60_000
const memory = new Map<Language, CachedDictionary>()
const pending = new Map<Language, Promise<void>>()

function isDictionary(value: unknown, language: Language): value is Dictionary {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<Dictionary>
  return data.language === language && typeof data.version === 'string' && data.fallbackLanguage === 'az' &&
    Boolean(data.messages) && typeof data.messages === 'object' && !Array.isArray(data.messages) &&
    Object.entries(data.messages).every(([key, text]) => Boolean(key) && typeof text === 'string')
}

function applyDictionary(dictionary: Dictionary) {
  const uiMessages = Object.fromEntries(Object.entries(dictionary.messages).filter(([key]) => key.startsWith('ui.')))
  i18n.addResourceBundle(dictionary.language, 'translation', uiMessages, true, true)
}

function readCache(language: Language) {
  try {
    const raw = window.localStorage.getItem(`${cachePrefix}${language}`)
    if (!raw) return null
    const cached = JSON.parse(raw) as CachedDictionary
    if (!isDictionary(cached, language) || typeof cached.checkedAt !== 'number') return null
    return cached
  } catch {
    return null
  }
}

function storeCache(dictionary: CachedDictionary) {
  memory.set(dictionary.language, dictionary)
  try {
    window.localStorage.setItem(`${cachePrefix}${dictionary.language}`, JSON.stringify(dictionary))
  } catch {
    // A valid in-memory dictionary remains usable if browser storage is full.
  }
}

export function restoreCachedDictionaries() {
  if (typeof window === 'undefined') return
  for (const language of ['az', 'en', 'ru'] as const) {
    const cached = readCache(language)
    if (!cached) continue
    memory.set(language, cached)
    applyDictionary(cached)
  }
}

function dictionaryUrl(language: Language) {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  return `${base.replace(/\/$/, '')}/localization/dictionaries/${language}`
}

export function refreshDictionary(language: Language = getCurrentLanguage(), force = false): Promise<void> {
  const cached = memory.get(language)
  if (!force && cached && Date.now() - cached.checkedAt < refreshAfterMs) return Promise.resolve()
  const current = pending.get(language)
  if (current) return current

  const request = (async () => {
    const headers = new Headers({ 'Accept-Language': language })
    if (cached?.etag) headers.set('If-None-Match', cached.etag)
    const response = await fetch(dictionaryUrl(language), { credentials: 'include', headers })
    if (response.status === 304 && cached) {
      storeCache({ ...cached, checkedAt: Date.now() })
      return
    }
    if (!response.ok) throw new Error(`Dictionary request failed: ${response.status}`)
    const payload: unknown = await response.json()
    const envelope = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
    if (!isDictionary(envelope, language)) throw new Error('Invalid dictionary response')
    const next: CachedDictionary = { ...envelope, etag: response.headers.get('ETag'), checkedAt: Date.now() }
    storeCache(next)
    applyDictionary(next)
  })().finally(() => pending.delete(language))

  pending.set(language, request)
  return request
}

export function getDictionaryVersion(language: Language): string | null {
  return memory.get(language)?.version ?? null
}
