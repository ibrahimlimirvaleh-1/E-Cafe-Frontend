import { useCallback, useEffect, useState } from 'react'
import { getDashboard, type DashboardPeriod, type DashboardPaymentMode, type DashboardResponse, type DashboardView } from '../../shared/api/dashboardApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { CurrentUser } from '../../shared/auth/jwt'
import { RoleIds } from '../../shared/auth/authz'
import type { DashboardTranslate } from './dashboardFormatting'

type ScopedResult = { key: string; identityKey: string; data: DashboardResponse }

function currentView(roleId?: string): DashboardView | null {
  if (roleId === RoleIds.PlatformAdmin) return 'platform'
  if (roleId === RoleIds.Owner) return 'owner'
  if (roleId === RoleIds.Manager) return 'manager'
  return null
}

export function useDashboardData(user: CurrentUser | null, t: DashboardTranslate) {
  const view = currentView(user?.roleId)
  const [period, setPeriod] = useState<DashboardPeriod>(() => view === 'manager' ? 'today' : 'week')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [paymentMode, setPaymentMode] = useState<DashboardPaymentMode>('real')
  const [restaurantId, setRestaurantId] = useState<number | null>(null)
  const [pageIndex, setPageIndex] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState<ScopedResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const managerRestaurantId = Number(user?.restaurantId)
  const effectiveRestaurantId = view === 'manager' ? managerRestaurantId : restaurantId ?? undefined
  const effectivePaymentMode = view === 'manager' ? 'real' : paymentMode
  const validCustomRange = period !== 'custom' || Boolean(from && to && from <= to)
  const hasManagerScope = Number.isSafeInteger(managerRestaurantId) && managerRestaurantId > 0
  const canLoad = Boolean(view && (view !== 'manager' || hasManagerScope) && validCustomRange)
  const identityKey = JSON.stringify([user?.userId, view, user?.restaurantId])
  const queryKey = JSON.stringify([user?.userId, view, effectiveRestaurantId, period, from, to, effectivePaymentMode, pageIndex])
  const data = result?.identityKey === identityKey && result.key === queryKey ? result.data : null
  const options = data?.restaurants ?? (result?.identityKey === identityKey ? result.data.restaurants : [])
  const refresh = useCallback(() => setReloadKey((value) => value + 1), [])

  useEffect(() => {
    setRestaurantId(null)
    setPageIndex(1)
    setPeriod(currentView(user?.roleId) === 'manager' ? 'today' : 'week')
  }, [user?.userId, user?.roleId, user?.restaurantId])

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 60_000)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('ecafe:notifications-refresh', refresh)
    }
  }, [refresh])

  useEffect(() => {
    if (!view || !canLoad) return
    const controller = new AbortController()
    setLoading(true)
    setError('')

    void getDashboard({
      view,
      restaurantId: effectiveRestaurantId,
      period,
      from: period === 'custom' ? from : undefined,
      to: period === 'custom' ? to : undefined,
      paymentMode: effectivePaymentMode,
      pageIndex,
    }, controller.signal).then((response) => {
      if (controller.signal.aborted) return
      if (response.view !== view || response.paymentMode !== effectivePaymentMode) {
        throw new Error(t('dashboard.error.mismatch'))
      }
      setResult({ key: queryKey, identityKey, data: response })
    }).catch((caught) => {
      if (!controller.signal.aborted) {
        setError(normalizeCaughtApiError(caught, t('dashboard.error.load')).message)
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [view, canLoad, effectiveRestaurantId, period, from, to, effectivePaymentMode, pageIndex, queryKey, identityKey, reloadKey, t])

  function changeRestaurant(id: number | null) {
    setRestaurantId(id)
    setPageIndex(1)
  }

  function changePeriod(next: DashboardPeriod) {
    setPeriod(next)
    setPageIndex(1)
  }

  function changePaymentMode(next: DashboardPaymentMode) {
    setPaymentMode(next)
    setPageIndex(1)
  }

  function changeFrom(value: string) {
    setFrom(value)
    setPageIndex(1)
  }

  function changeTo(value: string) {
    setTo(value)
    setPageIndex(1)
  }

  return {
    view,
    data,
    options,
    error,
    loading,
    canLoad,
    validCustomRange,
    hasManagerScope,
    managerRestaurantId,
    filters: { period, from, to, paymentMode, restaurantId },
    changeRestaurant,
    changePeriod,
    changePaymentMode,
    changeFrom,
    changeTo,
    setPageIndex,
    refresh,
  }
}

export type DashboardState = ReturnType<typeof useDashboardData>
