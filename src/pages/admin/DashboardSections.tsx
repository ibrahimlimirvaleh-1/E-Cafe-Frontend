import { AlertTriangle } from 'lucide-react'
import type { DashboardResponse, DashboardView } from '../../shared/api/dashboardApi'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { formatDashboardMoment, type DashboardFormatters, type DashboardTranslate } from './dashboardFormatting'

type CommonProps = {
  t: DashboardTranslate
  locale: string
  formatters: DashboardFormatters
}

const contractStatusCodes: Record<number, string> = {
  1: 'Draft',
  2: 'PendingSignature',
  3: 'Active',
  4: 'Expired',
  5: 'Terminated',
  6: 'OwnerApproved',
  7: 'Scheduled',
}

export function DashboardMetrics({ data, view, t, formatters }: CommonProps & { data: DashboardResponse; view: DashboardView }) {
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
      {data.metrics.map((metric) => (
        <div className="role-dashboard-metric" key={metric.key}>
          <span>{t(`dashboard.metric.${metric.key}`, { defaultValue: metric.key })}</span>
          <strong>{formatters.value(metric.value, metric.unit)}</strong>
          <small>{context(metric)}</small>
        </div>
      ))}
    </section>
  )
}

export function DashboardChart({ data, t, locale, formatters }: CommonProps & { data: DashboardResponse }) {
  const { chart, timeZone } = data
  const max = Math.max(1, ...chart.points.map((point) => point.value))

  return (
    <section className="role-dashboard-chart" aria-labelledby="role-dashboard-chart-title">
      <div className="role-dashboard-section-head">
        <div>
          <h2 id="role-dashboard-chart-title">
            {t(`dashboard.chart.${chart.key}`, { defaultValue: t('dashboard.chart.title') })}
          </h2>
          <p>{t('dashboard.chart.caption')}</p>
        </div>
        <span className="role-dashboard-chart-key"><i />{t('dashboard.currentPeriod')}</span>
      </div>

      {chart.points.length ? (
        <div className="role-dashboard-chart-scroll">
          <div className="role-dashboard-chart-plot" style={{ minWidth: `${Math.max(300, chart.points.length * 40)}px` }}>
            {chart.points.map((point) => (
              <div
                className="role-dashboard-chart-column"
                key={point.bucketStartUtc}
                title={`${formatDashboardMoment(point.bucketStartUtc, locale, timeZone)} · ${formatters.value(point.value, chart.unit)}`}
              >
                <span className="role-dashboard-chart-value">{formatters.number.format(point.value)}</span>
                <div className="role-dashboard-chart-track">
                  <div style={{ height: `${Math.max(point.value > 0 ? 3 : 0, point.value / max * 100)}%` }} />
                </div>
                <time>{formatDashboardMoment(point.bucketStartUtc, locale, timeZone, chart.granularity)}</time>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="role-dashboard-empty">{t('dashboard.noChartData')}</p>
      )}

      <div className="role-dashboard-chart-foot">
        <span>{t('dashboard.chart.unit')}: {chart.unit === 'AZN' ? 'AZN' : t('dashboard.count')}</span>
        <span>{t('dashboard.updated')}: {formatDashboardMoment(data.generatedAtUtc, locale, timeZone)}</span>
      </div>
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
        <span className="role-dashboard-alert-count">{alerts.length}</span>
      </div>
      {alerts.length ? (
        <ul>
          {alerts.map((alert) => (
            <li key={`${alert.key}-${alert.restaurantId ?? 'all'}`}>
              <div>
                <span className={`role-dashboard-alert-icon is-${alert.tone}`}><AlertTriangle size={17} /></span>
                <span>
                  <strong>{t(`dashboard.alert.${alert.key}`, { count: alert.count, defaultValue: alert.key })}</strong>
                  <small>{t('dashboard.alertCount', { count: alert.count })}</small>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="role-dashboard-empty">{t('dashboard.noAlerts')}</p>
      )}
    </section>
  )
}

export function DashboardFinancials({ data, t, formatters }: CommonProps & { data: DashboardResponse }) {
  if (!data.financials) return null
  const financials = data.financials
  const keys = ['collectedAmount', 'refundedAmount', 'netCollectedAmount', 'depositCollectedAmount', 'sessionCollectedAmount'] as const

  return (
    <section className="role-dashboard-financials" aria-label={t('dashboard.financials')}>
      <div className="role-dashboard-section-head">
        <div>
          <h2>{t('dashboard.financials')}</h2>
          <p>{t(`dashboard.modeDescription.${data.paymentMode}`)}</p>
        </div>
      </div>
      <dl>
        {keys.map((key) => (
          <div key={key}>
            <dt>{t(`dashboard.financial.${key}`)}</dt>
            <dd>{formatters.money.format(financials[key])}</dd>
          </div>
        ))}
      </dl>
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
        <td>{row.guestCount ?? '—'}</td>
        <td>{row.requiresReview ? '—' : formatters.money.format(row.orderAmount)}</td>
        <td>{row.requiresReview ? '—' : formatters.money.format(row.remainingAmount)}</td>
        <td><span className={`role-dashboard-status${tone}`}>{t(`dashboard.state.${state}`)}</span></td>
      </tr>
    )
  })
}

function BranchRows({ data, t, locale, formatters }: CommonProps & { data: DashboardResponse }) {
  return data.branchRows.map((row) => {
    const status = row.contractStatusId != null ? contractStatusCodes[row.contractStatusId] : undefined
    const tone = status === 'Expired' || status === 'Terminated'
      ? ' is-danger'
      : status === 'Active' ? '' : ' is-warning'

    return (
      <tr key={row.restaurantId}>
        <td><strong>{row.name}</strong><small>{row.branchName || '—'}</small></td>
        <td>{formatters.number.format(row.reservationCount)}</td>
        <td>{formatters.number.format(row.orderCount)}</td>
        <td>{formatters.money.format(row.orderAmount)}</td>
        <td>{formatters.money.format(row.collectedAmount)}</td>
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
    : ['branch', 'reservations', 'orders', 'orderAmount', 'collected', 'contract']
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
              <tr>{columns.map((key) => <th key={key} scope="col">{t(`dashboard.column.${key}`)}</th>)}</tr>
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
