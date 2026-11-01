import { useCallback, useEffect, useRef, useState } from 'react'
import { ecafeApi, type KitchenOrderResponse } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { hasCurrentCancellationRequest } from './cancellationRequest'
import { matchesOrderScope, ORDER_CHANGED_EVENT, ORDER_SYNC_EVENT, type OrderChangedPayload } from '../../shared/realtime/orderEvents'

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
    const confirmed = previous && (previous.statusId > order.statusId || previous.statusId === order.statusId && !hasCurrentCancellationRequest(order.cancellationRequest, previous.cancellationRequest)) ? previous : order
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
    let dirty = false

    function schedule(delay: number) {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        void load()
      }, delay)
    }

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
            if (order.statusId < confirmed.statusId) return confirmed
            if (order.statusId === confirmed.statusId && !hasCurrentCancellationRequest(order.cancellationRequest, confirmed.cancellationRequest)) return confirmed
            return order
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
        if (active && !document.hidden) {
          schedule(dirty ? 180 : pollDelayMs)
          dirty = false
        }
      }
    }

    function requestRefresh() {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      if (document.hidden || inFlight) {
        dirty = true
        return
      }
      schedule(180)
    }

    function onVisibilityChange() {
      if (!document.hidden) requestRefresh()
      else if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }
    function onOrderChanged(event: Event) {
      const payload = (event as CustomEvent<OrderChangedPayload>).detail
      if (payload && matchesOrderScope(payload, restaurantId)) requestRefresh()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', requestRefresh)
    window.addEventListener('ecafe:notifications-refresh', requestRefresh)
    window.addEventListener(ORDER_SYNC_EVENT, requestRefresh)
    window.addEventListener(ORDER_CHANGED_EVENT, onOrderChanged)
    void load()
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', requestRefresh)
      window.removeEventListener('ecafe:notifications-refresh', requestRefresh)
      window.removeEventListener(ORDER_SYNC_EVENT, requestRefresh)
      window.removeEventListener(ORDER_CHANGED_EVENT, onOrderChanged)
      if (timer !== null) window.clearTimeout(timer)
      inFlight?.abort()
    }
  }, [scopeKey, restaurantId, page, statusId, revision])

  return { ...(state.scopeKey === scopeKey ? state : { ...initialState, scopeKey }), applyOrder }
}
