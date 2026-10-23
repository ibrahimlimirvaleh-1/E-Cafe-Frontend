import { useCallback, useEffect, useRef, useState } from 'react'
import { ecafeApi, type KitchenOrderResponse } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'

type QueueState = {
  scopeKey: string
  data: PaginatedResponse<KitchenOrderResponse> | null
  error: string
  isStale: boolean
  lastSuccessAt: number | null
  isLoading: boolean
  isRefreshing: boolean
}

const initialState: QueueState = { scopeKey: '', data: null, error: '', isStale: false, lastSuccessAt: null, isLoading: true, isRefreshing: false }
const pollDelayMs = 20_000

function isTransientError(error: unknown) {
  return !(error instanceof ApiError) || error.statusCode === 0 || error.statusCode === 408 || error.statusCode === 429 || error.statusCode >= 500
}

// Növbə realtime siqnalda dərhal, ehtiyat kimi də ardıcıl poll ilə yenilənir.
export function useKitchenQueue(userId: string, restaurantId: string, page: number, statusId: number | null, revision: number) {
  const scopeKey = `${userId}:${restaurantId}:${statusId ?? 'all'}:${page}`
  const [state, setState] = useState<QueueState>(initialState)
  const scopeRef = useRef(scopeKey)
  const statusRef = useRef(statusId)
  const confirmedOrdersRef = useRef(new Map<number, KitchenOrderResponse>())
  scopeRef.current = scopeKey
  statusRef.current = statusId

  // POST cavabı GET-dən əvvəl gəlirsə, həmin sifarişin statusunu dərhal göstərir.
  const applyOrder = useCallback((order: KitchenOrderResponse) => {
    if (String(order.restaurantId) !== restaurantId) return
    const previous = confirmedOrdersRef.current.get(order.id)
    const confirmed = previous && previous.statusId > order.statusId ? previous : order
    confirmedOrdersRef.current.set(order.id, confirmed)
    setState((current) => current.scopeKey !== scopeRef.current || !current.data ? current : {
      ...current,
      data: {
        ...current.data,
        items: current.data.items
          .map((item) => item.id === order.id && item.statusId <= confirmed.statusId ? confirmed : item)
          .filter((item) => statusRef.current === null || item.statusId === statusRef.current),
      },
    })
  }, [restaurantId])

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
        const isStale = current.scopeKey === scopeKey && current.isStale
        return { scopeKey, data, error: isStale ? current.error : '', isStale, lastSuccessAt: current.scopeKey === scopeKey ? current.lastSuccessAt : null, isLoading: !data, isRefreshing: Boolean(data) }
      })
      try {
        const data = await ecafeApi.kitchen.listOrders(restaurantId, page, 20, statusId, controller.signal)
        if (active && scopeRef.current === scopeKey) {
          const items = data.items.map((order) => {
            const confirmed = confirmedOrdersRef.current.get(order.id)
            if (!confirmed) return order
            return order.statusId >= confirmed.statusId ? order : confirmed
          }).filter((order) => statusId === null || order.statusId === statusId)
          setState({ scopeKey, data: { ...data, items }, error: '', isStale: false, lastSuccessAt: Date.now(), isLoading: false, isRefreshing: false })
        }
      } catch (error) {
        if (active && scopeRef.current === scopeKey && !controller.signal.aborted) {
          const message = normalizeCaughtApiError(error, 'Mətbəx növbəsi yüklənmədi.').message
          setState((current) => {
            const keepData = current.scopeKey === scopeKey && Boolean(current.data) && isTransientError(error)
            if (!keepData) confirmedOrdersRef.current.clear()
            return { scopeKey, data: keepData ? current.data : null, error: message, isStale: keepData, lastSuccessAt: keepData ? current.lastSuccessAt : null, isLoading: false, isRefreshing: false }
          })
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
  }, [scopeKey, restaurantId, page, statusId, revision])

  return { ...(state.scopeKey === scopeKey ? state : { ...initialState, scopeKey }), applyOrder }
}
