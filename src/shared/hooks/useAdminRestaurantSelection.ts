import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'

// URL əsas mənbədir; bu yaddaş yalnız sessionStorage bloklananda seçimi qoruyur.
const fallbackSelections = new Map<string, string>()

// Saxlanmış seçimi oxuyur; storage bağlıdırsa yaddaşdakı dəyəri götürür.
function readSelection(key: string) {
  try {
    return sessionStorage.getItem(key) || fallbackSelections.get(key) || ''
  } catch {
    return fallbackSelections.get(key) || ''
  }
}

// Seçimi sessiyada və ehtiyat yaddaşda saxlayır.
function storeSelection(key: string, id: string) {
  fallbackSelections.set(key, id)
  try {
    sessionStorage.setItem(key, id)
  } catch {
    // URL və yaddaşdakı seçim işləməyə davam edir.
  }
}

// Seçim təmizlənəndə hər iki mənbəni boşaldır.
function clearSelection(key: string) {
  fallbackSelections.delete(key)
  try {
    sessionStorage.removeItem(key)
  } catch {
    // URL və yaddaşdakı seçim işləməyə davam edir.
  }
}

export function useAdminRestaurantSelection(restaurants: Restaurant[], userId?: string, defaultFirst = false) {
  const [searchParams, setSearchParams] = useSearchParams()
  const storageKey = `ecafe.adminRestaurant.${userId || 'anonymous'}`
  const queryId = searchParams.get('restaurantId') || ''
  const storedId = readSelection(storageKey)
  const isAccessible = (id: string) => restaurants.some((restaurant) => restaurant.id === id)
  const restaurantId = isAccessible(queryId)
    ? queryId
    : isAccessible(storedId) ? storedId : defaultFirst ? restaurants[0]?.id || '' : ''

  useEffect(() => {
    if (!restaurantId) return
    storeSelection(storageKey, restaurantId)
    if (queryId !== restaurantId) {
      const next = new URLSearchParams(searchParams)
      next.set('restaurantId', restaurantId)
      setSearchParams(next, { replace: true })
    }
  }, [restaurantId, queryId, searchParams, setSearchParams, storageKey])

  // Yeni restoranı URL-yə yazır ki, keçid və geri qayıtma konteksti qorusun.
  function selectRestaurant(id: string) {
    const next = new URLSearchParams(searchParams)
    if (id) {
      storeSelection(storageKey, id)
      next.set('restaurantId', id)
    } else {
      clearSelection(storageKey)
      next.delete('restaurantId')
    }
    setSearchParams(next, { replace: true })
  }

  return [restaurantId, selectRestaurant] as const
}
