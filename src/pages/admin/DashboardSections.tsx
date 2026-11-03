import {
  AlertCircle, BarChart3, BellRing, CalendarDays, ChefHat, CircleCheck, ClipboardList,
  CreditCard, FileClock, FileText, ListFilter, ReceiptText, ShoppingBag,
  LineChart, Store, Table2, Users, Wallet, type LucideIcon,
} from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import type { DashboardResponse, DashboardView } from '../../shared/api/dashboardApi'
import { mapContractStatus } from '../../shared/api/mappers'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { DashboardDonut } from './DashboardDonut'
import { formatDashboardMoment, type DashboardFormatters, type DashboardTranslate } from './dashboardFormatting'

type CommonProps = {
  t: DashboardTranslate
  locale: string
  formatters: DashboardFormatters
}

const metricAppearance: Record<string, { icon: LucideIcon; tone: string }> = {
  orderAmount: { icon: ShoppingBag, tone: 'teal' },
  collectedAmount: { icon: Wallet, tone: 'green' },
  orderCount: { icon: ClipboardList, tone: 'blue' },
  averageOrder: { icon: ReceiptText, tone: 'teal' },
  activeRestaurants: { icon: Store, tone: 'teal' },
  activeUsers: { icon: Users, tone: 'blue' },
  reservationCount: { icon: CalendarDays, tone: 'teal' },
  activeContracts: { icon: FileText, tone: 'green' },
  todayReservations: { icon: CalendarDays, tone: 'teal' },
  openSessions: { icon: Table2, tone: 'blue' },
  kitchenOrders: { icon: ChefHat, tone: 'teal' },
  readyOrders: { icon: BellRing, tone: 'red' },
}

const alertIcons: Record<string, LucideIcon> = {
  lowStock: ClipboardList,
  readyOrders: BellRing,
  delayedKitchen: ChefHat,
  waitingGuests: Users,
  expiringContracts: FileClock,
  failedPayments: CreditCard,
  pendingRefunds: Wallet,
  paymentReview: ReceiptText,
  closeReview: Table2,
}

const leadingMetric: Record<DashboardView, string> = {
  platform: 'reservationCount',
  owner: 'orderAmount',
  manager: 'todayReservations',
}

function chartScale(values: number[], unit: string) {
  const maximum = Math.max(0, ...values)
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4))
  const step = [1, 2, 2.5, 5, 10]
    .map((factor) => unit === 'count'
      ? Math.max(1, Math.ceil(factor * magnitude))
      : Math.max(0.01, Math.ceil(factor * magnitude * 100) / 100))
    .find((candidate) => Math.ceil(maximum / candidate) <= 5) ?? 10 * magnitude
  const segments = Math.ceil(maximum / step)
  return { maximum: segments * step, ticks: Array.from({ length: segments + 1 }, (_, index) => (segments - index) * step) }
}

function MetricSparkline({ points }: { points: DashboardResponse['chart']['points'] }) {
  const maximum = Math.max(0, ...points.map((point) => point.value))
  if (points.length < 2 || maximum <= 0 || points.some((point) => !Number.isFinite(point.value) || point.value < 0)) return null
  const coordinates = points.map((point, index) => ({
    x: 3 + index / (points.length - 1) * 84,
    y: 25 - point.value / maximum * 21,
  }))
  const path = coordinates.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ')
  return (
    <svg className="role-dashboard-metric-sparkline" viewBox="0 0 90 30" aria-hidden="true" focusable="false">
      <path d={`${path} V 29 H 3 Z`} fill="currentColor" opacity=".15" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="87" cy={coordinates[coordinates.length - 1].y} r="2.5" fill="currentColor" />
    </svg>
  )
}

export function DashboardMetrics({ data, view, t, formatters }: CommonProps & { data: DashboardResponse; view: DashboardView }) {
  const primary = data.metrics.find((metric) => metric.key === leadingMetric[view])
  const metrics = primary ? [primary, ...data.metrics.filter((metric) => metric !== primary)] : data.metrics
  function context(metric: DashboardResponse['metrics'][number]) {
    if (metric.previousValue != null && metric.changePercent != null) {
      const sign = metric.changePercent > 0 ? '+' : ''
      return `${sign}${formatters.number.format(metric.changePercent)}% ${t('dashboard.vsPrevious')}`
    }
    if (view === 'manager' && metric.key === 'todayReservations') return t('dashboard.today')
    if (view === 'manager' || ['activeRestaurants', 'activeUsers', 'activeContracts'].includes(metric.key)) {
      return t('dashboard.now')
    }
    return t('dashboard.currentPeriod')
  }

  return (
    <section className="role-dashboard-metrics" aria-label={t('dashboard.metrics')}>
      {metrics.map((metric) => {
        const Icon = metricAppearance[metric.key]?.icon ?? ClipboardList
        return (
        <div className={`role-dashboard-metric is-${metricAppearance[metric.key]?.tone ?? 'blue'}${metric === primary ? ' is-leading' : ''}`} key={metric.key}>
          <div className="role-dashboard-metric-head">
            <span>{t(`dashboard.metric.${metric.key}`, { defaultValue: metric.key })}</span>
            <span className="role-dashboard-metric-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
          </div>
          <strong>{formatters.value(metric.value, metric.unit)}</strong>
          <div className="role-dashboard-metric-foot">
            <small>{context(metric)}</small>
            {metric === primary && metric.key === data.chart.key && metric.unit === data.chart.unit
              ? <MetricSparkline points={data.chart.points} /> : null}
          </div>
        </div>
        )
      })}
    </section>
  )
}

export function DashboardChart({ data, t, locale, formatters }: CommonProps & { data: DashboardResponse }) {
  const [mode, setMode] = useState<'bar' | 'line'>('line')
  const [selection, setSelection] = useState<{ scope: string; bucket: string } | null>(null)
  const areaGradient = useId()
  const { chart, timeZone } = data
  const scope = JSON.stringify([chart.key, chart.unit, chart.granularity, data.from, data.to, data.paymentMode])
  const activeIndex = selection?.scope === scope ? chart.points.findIndex((point) => point.bucketStartUtc === selection.bucket) : -1
  const visiblePoint = chart.points[activeIndex] ?? chart.points.at(-1)
  const hasActivity = chart.points.some((point) => point.value > 0)
  const scale = hasActivity ? chartScale(chart.points.map((point) => point.value), chart.unit) : null
  const linePoints = scale ? chart.points.map((point, index) => ({
    x: (index + 0.5) / chart.points.length * 1000,
    y: 220 - Math.max(0, point.value) / scale.maximum * 220,
  })) : []
  const linePath = linePoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const areaPath = linePoints.length ? `${linePath} L ${linePoints.at(-1)!.x} 220 L ${linePoints[0].x} 220 Z` : ''

  function pointControl(point: DashboardResponse['chart']['points'][number], index: number) {
    const detail = `${formatDashboardMoment(point.bucketStartUtc, locale, timeZone)} · ${formatters.value(point.value, chart.unit)}`
    return {
      'aria-label': detail,
      'aria-pressed': index === activeIndex,
      'data-tooltip': detail,
      onClick: () => setSelection(index === activeIndex ? null : { scope, bucket: point.bucketStartUtc }),
      onKeyDown: focusPoint,
    }
  }

  function focusPoint(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      setSelection(null)
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const points = Array.from(event.currentTarget.closest('.role-dashboard-chart-body')?.querySelectorAll<HTMLElement>('.role-dashboard-chart-point-control') ?? [])
    const current = points.indexOf(event.currentTarget)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1
      : Math.max(0, Math.min(points.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))
    event.preventDefault()
    points[next]?.focus()
  }

  return (
    <section className="role-dashboard-chart" aria-labelledby="role-dashboard-chart-title">
      <div className="role-dashboard-section-head">
        <div>
          <h2 id="role-dashboard-chart-title">
            {t(`dashboard.chart.${chart.key}`, { defaultValue: t('dashboard.chart.title') })}
          </h2>
          <p>{t('dashboard.chart.caption')}</p>
        </div>
        <div className="role-dashboard-chart-actions">
          <span className="role-dashboard-chart-key"><i />{t('dashboard.currentPeriod')}</span>
          <div className="role-dashboard-chart-modes" role="group" aria-label={t('dashboard.chart.mode')}>
            <button type="button" aria-label={t('dashboard.chart.mode.bar')} title={t('dashboard.chart.mode.bar')}
              aria-pressed={mode === 'bar'} onClick={() => setMode('bar')}><BarChart3 size={16} aria-hidden="true" /></button>
            <button type="button" aria-label={t('dashboard.chart.mode.line')} title={t('dashboard.chart.mode.line')}
              aria-pressed={mode === 'line'} onClick={() => setMode('line')}><LineChart size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </div>

      {scale && visiblePoint ? <div className="role-dashboard-chart-reading" role="status">
        <div><span>{t('dashboard.chart.date')}</span><time dateTime={visiblePoint.bucketStartUtc}>{formatDashboardMoment(visiblePoint.bucketStartUtc, locale, timeZone)}</time></div>
        <div><span>{t('dashboard.chart.value')}</span><strong>{formatters.value(visiblePoint.value, chart.unit)}</strong></div>
      </div> : null}

      {scale ? (
        <div className="role-dashboard-chart-scroll">
          <div className="role-dashboard-chart-plot" style={{ minWidth: `${chart.points.length <= 7 ? 270 : chart.points.length * 52}px` }}>
            <div className="role-dashboard-chart-y-axis" aria-hidden="true">
              {scale.ticks.map((tick) => <span key={tick}>{formatters.number.format(tick)}</span>)}
            </div>
            <div className="role-dashboard-chart-body">
              <div className="role-dashboard-chart-grid" aria-hidden="true">
                {scale.ticks.map((tick) => <span key={tick} />)}
              </div>
              {mode === 'bar' ? <div className="role-dashboard-chart-bars" style={{ gridTemplateColumns: `repeat(${chart.points.length}, minmax(0, 1fr))` }}>
                {chart.points.map((point, index) => (
                  <button type="button" className="role-dashboard-chart-column role-dashboard-chart-point-control" key={point.bucketStartUtc} {...pointControl(point, index)}>
                    <span className="role-dashboard-chart-bar" style={{ height: `${point.value > 0 ? Math.max(1.5, point.value / scale.maximum * 100) : 0}%` }} />
                  </button>
                ))}
              </div> : <div className="role-dashboard-chart-line-plot">
                <svg viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <defs><linearGradient id={areaGradient} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity=".24" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity=".025" />
                  </linearGradient></defs>
                  <path className="role-dashboard-chart-area" d={areaPath} fill={`url(#${areaGradient})`} />
                  {activeIndex >= 0 ? <line className="role-dashboard-chart-guide" x1={linePoints[activeIndex].x} x2={linePoints[activeIndex].x} y1="0" y2="220" /> : null}
                  <path className="role-dashboard-chart-line" d={linePath} pathLength={1} />
                </svg>
                {chart.points.map((point, index) => (
                  <button type="button" className={`role-dashboard-chart-point role-dashboard-chart-point-control${linePoints[index].y < 52 ? ' is-high' : ''}`} key={point.bucketStartUtc}
                    {...pointControl(point, index)}
                    style={{ left: `${linePoints[index].x / 10}%`, top: `${linePoints[index].y}px`, width: `min(44px, ${100 / chart.points.length}%)` }} />
                ))}
              </div>}
              <div className="role-dashboard-chart-labels" style={{ gridTemplateColumns: `repeat(${chart.points.length}, minmax(0, 1fr))` }}>
                {chart.points.map((point, index) => (
                  <time key={point.bucketStartUtc} dateTime={point.bucketStartUtc} className={index === activeIndex ? 'is-active' : undefined}>{formatDashboardMoment(point.bucketStartUtc, locale, timeZone, chart.granularity)}</time>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="role-dashboard-empty role-dashboard-chart-empty" role="status"><ListFilter size={18} aria-hidden="true" />{t('dashboard.noChartData')}</p>
      )}

      <div className="role-dashboard-chart-foot">
        <span>{t('dashboard.chart.unit')}: {chart.unit === 'AZN' ? 'AZN' : t('dashboard.count')}</span>
        <span>{t('dashboard.updated')}: {formatDashboardMoment(data.generatedAtUtc, locale, timeZone)}</span>
      </div>
      {chart.points.length ? <details className="role-dashboard-chart-data">
        <summary><Table2 size={15} aria-hidden="true" />{t('dashboard.chart.dataTable')}</summary>
        <div><table>
          <thead><tr><th scope="col">{t('dashboard.chart.date')}</th><th scope="col" className="is-numeric">{t('dashboard.chart.value')}</th></tr></thead>
          <tbody>{chart.points.map((point) => <tr key={point.bucketStartUtc}>
            <td>{formatDashboardMoment(point.bucketStartUtc, locale, timeZone)}</td>
            <td className="is-numeric">{formatters.value(point.value, chart.unit)}</td>
          </tr>)}</tbody>
        </table></div>
      </details> : null}
    </section>
  )
}

export function DashboardAlerts({ data, t }: { data: DashboardResponse; t: DashboardTranslate }) {
  const alerts = data.alerts.filter((alert) => alert.count > 0)

  return (
    <section className="role-dashboard-alerts" aria-labelledby="role-dashboard-alert-title">
      <div className="role-dashboard-section-head">
        <div>
          <h2 id="role-dashboard-alert-title">{t('dashboard.attention')}</h2>
          <p>{t('dashboard.liveState')}</p>
        </div>
        <span className="role-dashboard-alert-count" aria-hidden="true"><BellRing size={15} /></span>
      </div>
      {alerts.length ? (
        <ul>
          {alerts.map((alert) => {
            const Icon = alertIcons[alert.key] ?? AlertCircle
            return (
            <li key={`${alert.key}-${alert.restaurantId ?? 'all'}`}>
              <div>
                <span className={`role-dashboard-alert-icon is-${alert.tone}`} aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
                <span>
                  <strong>{t(`dashboard.alert.${alert.key}`, { count: alert.count, defaultValue: alert.key })}</strong>
                </span>
                <span className="role-dashboard-alert-quantity">{alert.count}</span>
              </div>
            </li>
            )
          })}
        </ul>
      ) : (
        <p className="role-dashboard-empty role-dashboard-alert-empty"><CircleCheck size={20} aria-hidden="true" />{t('dashboard.noAlerts')}</p>
      )}
    </section>
  )
}

export function DashboardFinancials({ data, t, formatters }: CommonProps & { data: DashboardResponse }) {
  if (!data.financials) return null
  const financials = data.financials
  const amounts = [financials.collectedAmount, financials.depositCollectedAmount, financials.sessionCollectedAmount]
  const cents = amounts.map((value) => Math.round(value * 100))
  const otherCents = cents[0] - cents[1] - cents[2]
  const other = otherCents / 100
  const showComposition = amounts.every((value, index) => Number.isFinite(value) && value >= 0 && Number.isSafeInteger(cents[index])) && otherCents >= 0
  const keys = showComposition && cents[0] > 0
    ? (['netCollectedAmount', 'refundedAmount'] as const)
    : (['netCollectedAmount', 'refundedAmount', 'collectedAmount', 'depositCollectedAmount', 'sessionCollectedAmount'] as const)

  return (
    <section className="role-dashboard-financials" aria-label={t('dashboard.financials')}>
      <div className="role-dashboard-section-head">
        <div>
          <h2>{t('dashboard.financials')}</h2>
          <p>{t(`dashboard.modeDescription.${data.paymentMode}`)}</p>
        </div>
      </div>
      <div className={`role-dashboard-financial-layout${showComposition ? ' has-composition' : ''}`}>
      {showComposition ? <DashboardDonut title={t('dashboard.financial.composition')} total={cents[0] / 100}
        totalLabel={t('dashboard.financial.collectedAmount')} totalFormatted={formatters.money.format(financials.collectedAmount)}
        emptyLabel={t('dashboard.financial.noComposition')} note={t('dashboard.financial.compositionNote')}
        parts={[
          { label: t('dashboard.financial.depositCollectedAmount'), value: cents[1] / 100, formatted: formatters.money.format(financials.depositCollectedAmount), color: 'var(--dashboard-teal)' },
          { label: t('dashboard.financial.sessionCollectedAmount'), value: cents[2] / 100, formatted: formatters.money.format(financials.sessionCollectedAmount), color: 'var(--dashboard-blue)' },
          { label: t('dashboard.financial.otherCollectedAmount'), value: Math.max(0, other), formatted: formatters.money.format(Math.max(0, other)), color: 'var(--secondary)' },
        ]} /> : null}
      <dl>
        {keys.map((key) => (
          <div key={key} className={key === 'netCollectedAmount' ? 'is-net' : key === 'refundedAmount' ? 'is-refund' : undefined}>
            <dt>{t(`dashboard.financial.${key}`)}</dt>
            <dd>{formatters.money.format(financials[key])}</dd>
          </div>
        ))}
      </dl>
      </div>
    </section>
  )
}

function SessionRows({ data, t, locale, formatters }: CommonProps & { data: DashboardResponse }) {
  return data.sessionRows.map((row) => {
    const state = row.requiresReview
      ? 'review'
      : row.hasPendingPayment
        ? 'payment'
        : row.readyCount
          ? 'ready'
          : row.preparingCount
            ? 'preparing'
            : 'open'
    const tone = row.requiresReview ? ' is-danger' : row.hasPendingPayment || row.readyCount ? ' is-warning' : ''

    return (
      <tr key={row.sessionId}>
        <td>
          <strong>{row.tableName}</strong>
          <small>#{row.sessionId} · {formatDashboardMoment(row.openedAt, locale, data.timeZone)}</small>
        </td>
        <td>{row.waiterName || '—'}</td>
        <td className="is-numeric">{row.guestCount ?? '—'}</td>
        <td className="is-numeric">{row.requiresReview ? '—' : formatters.money.format(row.orderAmount)}</td>
        <td className="is-numeric">{row.requiresReview ? '—' : formatters.money.format(row.remainingAmount)}</td>
        <td><span className={`role-dashboard-status${tone}`}>{t(`dashboard.state.${state}`)}</span></td>
      </tr>
    )
  })
}

function BranchRows({ data, t, locale, formatters }: CommonProps & { data: DashboardResponse }) {
  return data.branchRows.map((row) => {
    const statusId = row.contractStatusId
    const status = statusId != null && Number.isInteger(statusId) && statusId >= 6001 && statusId <= 6007
      ? mapContractStatus(statusId)
      : undefined
    const tone = status === 'Expired' || status === 'Terminated'
      ? ' is-danger'
      : status === 'Active' ? '' : ' is-warning'

    return (
      <tr key={row.restaurantId}>
        <td><strong>{row.name}</strong><small>{row.branchName || '—'}</small></td>
        <td className="is-numeric">{formatters.number.format(row.reservationCount)}</td>
        <td className="is-numeric">{formatters.number.format(row.orderCount)}</td>
        <td className="is-numeric">{formatters.money.format(row.orderAmount)}</td>
        <td className="is-numeric">{formatters.money.format(row.collectedAmount)}</td>
        <td>
          {row.contractId == null ? t('dashboard.noContract') : (
            <>
              <span className={`role-dashboard-status${tone}`}>
                {status ? t(`adminFlow.contractStatus.${status}`, { defaultValue: status }) : t('dashboard.unknownContract')}
              </span>
              {row.contractEndsAt ? <small>{formatDashboardMoment(row.contractEndsAt, locale, data.timeZone)}</small> : null}
            </>
          )}
        </td>
      </tr>
    )
  })
}

export function DashboardTable({ data, view, t, locale, formatters, onPageChange }: CommonProps & {
  data: DashboardResponse
  view: DashboardView
  onPageChange: (pageIndex: number) => void
}) {
  const manager = view === 'manager'
  const rows = manager ? data.sessionRows : data.branchRows
  const columns = manager
    ? ['table', 'waiter', 'guests', 'orderAmount', 'remaining', 'state']
    : ['branch', 'reservations', 'orders', 'confirmedOrderAmount', 'collected', 'contract']
  const totalPages = Math.max(1, Math.ceil(data.totalRows / Math.max(1, data.pageSize)))

  return (
    <section className="role-dashboard-table-section" aria-labelledby="role-dashboard-table-title">
      <div className="role-dashboard-section-head">
        <div>
          <h2 id="role-dashboard-table-title">{t(manager ? 'dashboard.sessions' : 'dashboard.branches')}</h2>
          <p>{t('dashboard.tableCaption')}</p>
        </div>
        <span className="role-dashboard-row-count">{t('dashboard.totalRows', { count: data.totalRows })}</span>
      </div>

      {rows.length ? (
        <div className="role-dashboard-table-scroll">
          <table>
            <thead>
              <tr>{columns.map((key) => <th key={key} scope="col"
                className={['guests', 'orderAmount', 'remaining', 'reservations', 'orders', 'confirmedOrderAmount', 'collected'].includes(key) ? 'is-numeric' : undefined}>
                {t(`dashboard.column.${key}`)}
              </th>)}</tr>
            </thead>
            <tbody>
              {manager
                ? <SessionRows data={data} t={t} locale={locale} formatters={formatters} />
                : <BranchRows data={data} t={t} locale={locale} formatters={formatters} />}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="role-dashboard-empty">{t('dashboard.noRows')}</p>
      )}

      <PaginationControls
        ariaLabel={t('dashboard.pages')}
        pageIndex={data.pageIndex}
        totalPages={totalPages}
        hasPreviousPage={data.pageIndex > 1}
        hasNextPage={data.pageIndex < totalPages}
        onPageChange={onPageChange}
      />
    </section>
  )
}
