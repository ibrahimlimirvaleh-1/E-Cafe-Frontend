import { endpoints } from './endpoints'
import { fetchProtectedBlob, httpClient } from './httpClient'

export type DashboardView = 'platform' | 'owner' | 'manager'
export type DashboardPeriod = 'today' | 'week' | 'month' | 'custom'
export type DashboardPaymentMode = 'real' | 'test'
export type DashboardReportKind = 'orders' | 'reservations' | 'payments'
export type DashboardPaymentEvent = 'all' | 'receipt' | 'refund'

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

export type DashboardReportQuery = DashboardQuery & {
  kind: DashboardReportKind
  statusId?: number
  paymentEvent?: DashboardPaymentEvent
}

export type DashboardReportResponse = {
  kind: DashboardReportKind
  generatedAtUtc: string
  timeZone: string
  from: string
  to: string
  paymentMode: DashboardPaymentMode
  metrics: DashboardResponse['metrics']
  orders: Array<{
    id: number; restaurantId: number; restaurantName: string; tableName: string; tableSessionId: number | null
    sourceId: number; statusId: number; openedAtUtc: string; sentToKitchenAtUtc: string | null
    servedAtUtc: string | null; itemQuantity: number; itemSubtotal: number; confirmedAmount: number
  }>
  reservations: Array<{
    id: number; restaurantId: number; restaurantName: string; tableName: string; statusId: number
    reservedAtUtc: string; peopleCount: number; depositAmount: number; arrivedAtUtc: string | null; seatedAtUtc: string | null
  }>
  payments: Array<{
    id: number; event: 'receipt' | 'refund'; restaurantId: number; restaurantName: string
    occurredAtUtc: string; amount: number; purpose: 'deposit' | 'session' | 'order' | 'other'
    reservationId: number | null; tableSessionId: number | null; statusId: number; isTest: boolean
  }>
  pageIndex: number
  pageSize: number
  totalRows: number
}

function reportParams(query: DashboardReportQuery) {
  const params = new URLSearchParams({
    kind: query.kind,
    period: query.period,
    paymentMode: query.paymentMode,
    pageIndex: String(query.pageIndex),
  })
  if (query.restaurantId) params.set('restaurantId', String(query.restaurantId))
  if (query.period === 'custom' && query.from && query.to) {
    params.set('from', query.from)
    params.set('to', query.to)
  }
  if (query.kind === 'payments') params.set('paymentEvent', query.paymentEvent ?? 'all')
  else if (query.statusId) params.set('statusId', String(query.statusId))
  return params
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

export async function getDashboardReport(query: DashboardReportQuery, signal: AbortSignal): Promise<DashboardReportResponse> {
  const response = await httpClient<DashboardReportResponse>(`${endpoints.dashboardReports[query.view]}?${reportParams(query)}`, { signal })
  return response.data
}

export function exportDashboardReport(query: DashboardReportQuery, signal: AbortSignal): Promise<Blob> {
  return fetchProtectedBlob(`${endpoints.dashboardReportExports[query.view]}?${reportParams(query)}`, { signal })
}
