import { endpoints } from './endpoints'
import { httpClient } from './httpClient'

export type DashboardView = 'platform' | 'owner' | 'manager'
export type DashboardPeriod = 'today' | 'week' | 'month' | 'custom'
export type DashboardPaymentMode = 'real' | 'test'

export type DashboardQuery = {
  view: DashboardView
  restaurantId?: number
  period: DashboardPeriod
  from?: string
  to?: string
  paymentMode: DashboardPaymentMode
  pageIndex: number
}

export type DashboardResponse = {
  view: DashboardView
  generatedAtUtc: string
  from: string
  to: string
  timeZone: string
  paymentMode: DashboardPaymentMode
  restaurants: Array<{ id: number; name: string; branchName: string | null; timeZone: string }>
  hasMoreRestaurants: boolean
  metrics: Array<{ key: string; value: number; unit: string; previousValue: number | null; changePercent: number | null }>
  financials: null | {
    collectedAmount: number
    refundedAmount: number
    netCollectedAmount: number
    depositCollectedAmount: number
    sessionCollectedAmount: number
  }
  chart: {
    key: string
    unit: string
    granularity: 'hour' | 'day'
    points: Array<{ bucketStartUtc: string; value: number }>
  }
  alerts: Array<{ key: string; count: number; tone: 'warning' | 'danger'; restaurantId: number | null }>
  branchRows: Array<{
    restaurantId: number
    name: string
    branchName: string | null
    isActive: boolean
    reservationCount: number
    orderCount: number
    orderAmount: number
    collectedAmount: number
    refundedAmount: number
    contractId: number | null
    contractStatusId: number | null
    contractEndsAt: string | null
  }>
  sessionRows: Array<{
    sessionId: number
    restaurantId: number
    tableId: number
    tableName: string
    waiterName: string | null
    reservationId: number | null
    guestCount: number | null
    openedAt: string
    orderAmount: number
    remainingAmount: number
    preparingCount: number
    readyCount: number
    hasPendingPayment: boolean
    requiresReview: boolean
  }>
  pageIndex: number
  pageSize: number
  totalRows: number
}

export async function getDashboard(query: DashboardQuery, signal: AbortSignal): Promise<DashboardResponse> {
  const params = new URLSearchParams({
    period: query.period,
    paymentMode: query.paymentMode,
    pageIndex: String(query.pageIndex),
  })
  if (query.restaurantId) params.set('restaurantId', String(query.restaurantId))
  if (query.period === 'custom' && query.from && query.to) {
    params.set('from', query.from)
    params.set('to', query.to)
  }

  const response = await httpClient<DashboardResponse>(`${endpoints.dashboard[query.view]}?${params}`, { signal })
  return response.data
}
