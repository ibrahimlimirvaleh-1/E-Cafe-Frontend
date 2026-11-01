import { useEffect, useRef } from 'react'
import { matchesOrderScope, ORDER_CHANGED_EVENT, ORDER_SYNC_EVENT, type OrderChangedPayload } from './orderEvents'

export function useOrderInvalidation(
  restaurantId: string,
  tableSessionId: number | null,
  enabled: boolean,
  isLoading: boolean,
  refresh: () => void,
) {
  const refreshRef = useRef(refresh)
  const loadingRef = useRef(isLoading)
  const flushRef = useRef<(() => void) | null>(null)
  refreshRef.current = refresh
  loadingRef.current = isLoading

  useEffect(() => {
    if (!enabled || !restaurantId) return
    let pending = false
    let timer: number | null = null

    function request() {
      if (document.hidden || loadingRef.current) {
        pending = true
        return
      }
      if (timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        if (document.hidden || loadingRef.current) {
          pending = true
          return
        }
        pending = false
        refreshRef.current()
      }, 200)
    }
    function flush() {
      if (pending) request()
    }
    function onChanged(event: Event) {
      const detail = (event as CustomEvent<OrderChangedPayload>).detail
      if (detail && matchesOrderScope(detail, restaurantId, tableSessionId)) request()
    }
    function onVisible() {
      if (!document.hidden) flush()
    }

    flushRef.current = flush
    window.addEventListener(ORDER_CHANGED_EVENT, onChanged)
    window.addEventListener(ORDER_SYNC_EVENT, request)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      flushRef.current = null
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener(ORDER_CHANGED_EVENT, onChanged)
      window.removeEventListener(ORDER_SYNC_EVENT, request)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, restaurantId, tableSessionId])

  useEffect(() => {
    if (!isLoading) flushRef.current?.()
  }, [isLoading])
}
