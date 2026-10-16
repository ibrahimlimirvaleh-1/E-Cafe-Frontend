import { useCallback, useEffect, useRef, useState } from 'react'
import { ecafeApi, type KitchenOrderResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'

type QueueState = {
  scopeKey: string
  data: PaginatedResponse<KitchenOrderResponse> | null
  error: string
  isLoading: boolean
  isRefreshing: boolean
}

const initialState: QueueState = { scopeKey: '', data: null, error: '', isLoading: true, isRefreshing: false }
const pollDelayMs = 20_000

// Növbə realtime siqnalda dərhal, ehtiyat kimi də ardıcıl poll ilə yenilənir.
export function useKitchenQueue(userId: string, restaurantId: string, page: number, revision: number) {
  const scopeKey = `${userId}:${restaurantId}:${page}`
  const [state, setState] = useState<QueueState>(initialState)
  const scopeRef = useRef(scopeKey)
  const confirmedOrdersRef = useRef(new Map<number, KitchenOrderResponse>())
  scopeRef.current = scopeKey

  useEffect(() => {
    confirmedOrdersRef.current.clear()
  }, [scopeKey])

  // POST cavabı GET-dən əvvəl gəlirsə, həmin sifarişin statusunu dərhal göstərir.
  const applyOrder = useCallback((order: KitchenOrderResponse) => {
    if (scopeRef.current !== scopeKey || String(order.restaurantId) !== restaurantId) return
    const previous = confirmedOrdersRef.current.get(order.id)
    const confirmed = previous && previous.statusId > order.statusId ? previous : order
    confirmedOrdersRef.current.set(order.id, confirmed)
    setState((current) => current.scopeKey !== scopeKey || !current.data ? current : {
      ...current,
      data: { ...current.data, items: current.data.items.map((item) => item.id === order.id && item.statusId <= confirmed.statusId ? confirmed : item) },
    })
  }, [scopeKey, restaurantId])

  useEffect(() => {
    let active = true
    let timer: number | null = null
    let inFlight: AbortController | null = null

    // Sorğular ardıcıl gedir; köhnə restoran/səhifə cavabı yeni növbəyə yazılmır.
    async function load() {
      if (!active || inFlight || document.hidden) return
      const controller = new AbortController()
      inFlight = controller
      setState((current) => {
        const data = current.scopeKey === scopeKey ? current.data : null
        return { scopeKey, data, error: '', isLoading: !data, isRefreshing: Boolean(data) }
      })
      try {
        const data = await ecafeApi.kitchen.listOrders(restaurantId, page, 20, controller.signal)
        if (active && scopeRef.current === scopeKey) {
          const items = data.items.map((order) => {
            const confirmed = confirmedOrdersRef.current.get(order.id)
            if (!confirmed) return order
            if (order.statusId >= confirmed.statusId) {
              confirmedOrdersRef.current.delete(order.id)
              return order
            }
            return confirmed
          })
          setState({ scopeKey, data: { ...data, items }, error: '', isLoading: false, isRefreshing: false })
        }
      } catch (error) {
        if (active && scopeRef.current === scopeKey && !controller.signal.aborted) {
          setState({ scopeKey, data: null, error: normalizeCaughtApiError(error, 'Mətbəx növbəsi yüklənmədi.').message, isLoading: false, isRefreshing: false })
        }
      } finally {
        if (inFlight === controller) inFlight = null
        if (active && !document.hidden) timer = window.setTimeout(() => void load(), pollDelayMs)
      }
    }

    function onVisibilityChange() {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      if (!document.hidden) void load()
    }

    function onNotificationsChanged() {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      void load()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('ecafe:notifications-refresh', onNotificationsChanged)
    void load()
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('ecafe:notifications-refresh', onNotificationsChanged)
      if (timer !== null) window.clearTimeout(timer)
      inFlight?.abort()
    }
  }, [scopeKey, restaurantId, page, revision])

  return { ...(state.scopeKey === scopeKey ? state : { ...initialState, scopeKey }), applyOrder }
}
