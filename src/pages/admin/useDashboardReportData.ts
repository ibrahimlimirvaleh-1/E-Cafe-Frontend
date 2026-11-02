import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import { exportDashboardReport, getDashboardReport, type DashboardPaymentEvent, type DashboardReportKind, type DashboardReportQuery, type DashboardReportResponse, type DashboardView } from '../../shared/api/dashboardApi'
import type { DashboardTranslate } from './dashboardFormatting'
import type { DashboardState } from './useDashboardData'

type ScopedResult = { key: string; data: DashboardReportResponse }

export function useDashboardReportData(state: DashboardState, view: DashboardView, userId: string | undefined,
  kind: DashboardReportKind, statusId: number | null, paymentEvent: DashboardPaymentEvent, dayStartHour: number, reloadKey: number, t: DashboardTranslate) {
  const [pageIndex, setPageIndex] = useState(1)
  const [result, setResult] = useState<ScopedResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const exportAbort = useRef<AbortController | null>(null)
  const { period, from, to, paymentMode, restaurantId } = state.filters
  const scopedRestaurantId = view === 'manager' ? state.managerRestaurantId : restaurantId ?? undefined
  const query = useMemo<DashboardReportQuery>(() => ({
    view, kind, period, from, to, restaurantId: scopedRestaurantId,
    paymentMode: ['payments', 'settlements', 'branches'].includes(kind) ? paymentMode : 'real',
    statusId: kind === 'orders' || kind === 'reservations' ? statusId ?? undefined : undefined,
    paymentEvent: kind === 'payments' ? paymentEvent : undefined,
    dayStartHour,
    pageIndex,
  }), [view, kind, period, from, to, scopedRestaurantId, paymentMode, statusId, paymentEvent, dayStartHour, pageIndex])
  const key = JSON.stringify([userId, query])
  const filterKey = JSON.stringify([userId, view, kind, period, from, to, scopedRestaurantId, query.paymentMode, statusId, paymentEvent, dayStartHour])
  const canLoad = state.canLoad && (view !== 'manager' || !['payments', 'settlements', 'branches'].includes(kind))
  const data = result?.key === key ? result.data : null

  useEffect(() => { setPageIndex(1) }, [filterKey])

  useEffect(() => {
    if (!canLoad) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void getDashboardReport(query, controller.signal).then((response) => {
      if (controller.signal.aborted) return
      if (response.kind !== kind || response.dayStartHour !== dayStartHour || ['payments', 'settlements', 'branches'].includes(kind) && response.paymentMode !== query.paymentMode) {
        throw new Error(t('dashboardReports.responseMismatch'))
      }
      setResult({ key, data: response })
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(normalizeCaughtApiError(caught, t('dashboardReports.loadError')).message)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [canLoad, key, kind, query, reloadKey, t])

  useEffect(() => {
    exportAbort.current?.abort()
    exportAbort.current = null
    setExporting(false)
    setExportError('')
    return () => { exportAbort.current?.abort() }
  }, [key])

  async function download() {
    if (!data || !canLoad || exporting) return
    const controller = new AbortController()
    exportAbort.current = controller
    setExporting(true)
    setExportError('')
    try {
      const blob = await exportDashboardReport(query, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ecafe-${kind}-${data.from}-${data.to}-h${String(dayStartHour).padStart(2, '0')}${['payments', 'settlements', 'branches'].includes(kind) ? `-${query.paymentMode}` : ''}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (caught) {
      if (!controller.signal.aborted) setExportError(caught instanceof ApiError && caught.code === 'DashboardExportLimitExceeded'
        ? t('dashboardReports.exportLimit') : normalizeCaughtApiError(caught, t('dashboardReports.exportError')).message)
    } finally {
      if (exportAbort.current === controller) {
        exportAbort.current = null
        setExporting(false)
      }
    }
  }

  return { data, error, loading, exporting, exportError, pageIndex, setPageIndex, download }
}
