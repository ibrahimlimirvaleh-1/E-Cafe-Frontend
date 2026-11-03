import { CalendarDays, Download, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { DashboardPaymentEvent, DashboardReportKind, DashboardReportResponse, DashboardView } from '../../shared/api/dashboardApi'
import { formatDateOnlyAz } from '../../shared/lib/dateFormatting'
import { orderKitchenLabel } from '../../shared/lib/orderStatus'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { DashboardDonut } from './DashboardDonut'
import { formatDashboardMoment, type DashboardFormatters, type DashboardTranslate } from './dashboardFormatting'
import { useDashboardReportData } from './useDashboardReportData'
import { OperationalReportTable } from './OperationalReportTable'
import type { DashboardState } from './useDashboardData'

type Props = {
  state: DashboardState
  view: DashboardView
  userId: string | undefined
  kind: DashboardReportKind
  onKindChange: (kind: DashboardReportKind) => void
  reloadKey: number
  t: DashboardTranslate
  locale: string
  formatters: DashboardFormatters
}

const orderStatuses = [
  { id: 2009, key: 'orderStatus.pendingWaiterConfirmation' },
  { id: 2001, key: 'dashboardReports.status.created' },
  { id: 2008, key: 'orderStatus.scheduled' },
  { id: 2002, key: 'orderStatus.accepted' },
  { id: 2003, key: 'orderStatus.preparing' },
  { id: 2004, key: 'orderStatus.ready' },
  { id: 2005, key: 'orderStatus.served' },
  { id: 2006, key: 'orderStatus.closed' },
  { id: 2007, key: 'orderStatus.cancelled' },
] as const

const reservationStatuses = [
  { id: 1010, key: 'status.restaurantResponse' },
  { id: 1001, key: 'status.pendingPayment' },
  { id: 1008, key: 'status.paymentSubmitted' },
  { id: 1002, key: 'status.confirmed' },
  { id: 1003, key: 'status.seated' },
  { id: 1004, key: 'status.completed' },
  { id: 1005, key: 'status.cancelled' },
  { id: 1006, key: 'status.noShow' },
  { id: 1007, key: 'status.expired' },
  { id: 1009, key: 'status.rejected' },
] as const

const reportGroups: Array<{ key: string; kinds: DashboardReportKind[] }> = [
  { key: 'sales', kinds: ['orders', 'products'] },
  { key: 'service', kinds: ['kitchen', 'cancellations', 'tables'] },
  { key: 'reservations', kinds: ['reservations', 'reservation-outcomes'] },
  { key: 'finance', kinds: ['payments', 'settlements', 'branches'] },
  { key: 'inventory', kinds: ['stock'] },
]

const financialKinds: DashboardReportKind[] = ['payments', 'settlements', 'branches']
const operationalKinds: DashboardReportKind[] = ['products', 'kitchen', 'cancellations', 'reservation-outcomes', 'tables', 'settlements', 'branches', 'stock']

function reportLabel(kind: DashboardReportKind, t: DashboardTranslate) {
  return t(operationalKinds.includes(kind) ? `operationalReports.kind.${kind}` : `dashboardReports.kind.${kind}`)
}

function statusTone(statusId: number) {
  if ([2007, 1005, 1006, 1007, 1009].includes(statusId)) return ' is-danger'
  if ([2009, 2001, 2008, 1001, 1008, 1010].includes(statusId)) return ' is-warning'
  return ''
}

function ReservationStatus({ statusId, t }: { statusId: number; t: DashboardTranslate }) {
  const status = reservationStatuses.find((entry) => entry.id === statusId)
  return <span className={`role-dashboard-status${statusTone(statusId)}`}>
    {status ? t(status.key) : t('dashboardReports.unknownStatus')}
  </span>
}

function ReportMetrics({ data, t, formatters }: { data: DashboardReportResponse; t: DashboardTranslate; formatters: DashboardFormatters }) {
  return <section className="role-dashboard-report-metrics" aria-label={t('dashboard.metrics')}>
    {data.metrics.map((metric) => <div className="role-dashboard-report-metric" key={metric.key}>
      <span>{t(`${operationalKinds.includes(data.kind) ? 'operationalReports' : 'dashboardReports'}.metric.${metric.key}`, { defaultValue: metric.key })}</span>
      <strong>{metric.unit === 'minutes' ? `${formatters.preciseNumber.format(metric.value)} ${t('operationalReports.unit.minutes')}`
        : metric.unit === 'percent' ? `${formatters.preciseNumber.format(metric.value)}%` : formatters.value(metric.value, metric.unit)}</strong>
    </div>)}
  </section>
}

function ReportRows({ data, view, t, locale, formatters }: {
  data: DashboardReportResponse; view: DashboardView; t: DashboardTranslate; locale: string; formatters: DashboardFormatters
}) {
  const timezone = data.timeZone
  if (data.kind === 'orders') return <>
    {data.orders.map((row) => <tr key={row.id}>
      <td data-label={t('dashboardReports.column.order')}><strong>#{row.id}</strong><small>{t(`dashboardReports.source.${row.sourceId}`, { defaultValue: t('dashboardReports.source.unknown') })}</small></td>
      <td data-label={t('dashboardReports.column.location')}><strong>{row.restaurantName}</strong><small>{row.tableName}</small></td>
      <td data-label={t('dashboardReports.column.date')}>{formatDashboardMoment(row.openedAtUtc, locale, timezone)}
        {row.sentToKitchenAtUtc ? <small>{t('dashboardReports.sentAt')}: {formatDashboardMoment(row.sentToKitchenAtUtc, locale, timezone)}</small> : null}
        {row.servedAtUtc ? <small>{t('dashboardReports.servedAt')}: {formatDashboardMoment(row.servedAtUtc, locale, timezone)}</small> : null}
      </td>
      <td data-label={t('dashboardReports.column.status')}><span className={`role-dashboard-status${statusTone(row.statusId)}`}>{orderKitchenLabel(row.statusId, row.sentToKitchenAtUtc)}</span></td>
      <td data-label={t('dashboardReports.column.itemUnits')} className="is-numeric">{formatters.number.format(row.itemQuantity)}</td>
      <td data-label={t('dashboardReports.column.originalSubtotal')} className={`is-numeric${row.statusId === 2007 ? ' is-cancelled-quote' : ''}`}>
        {formatters.money.format(row.itemSubtotal)}
        {row.statusId === 2007 ? <small>{t('dashboardReports.cancelledOriginal')}</small> : null}
      </td>
      {view !== 'manager' ? <td data-label={t('dashboardReports.column.confirmedOrderAmount')} className="is-numeric">{formatters.money.format(row.confirmedAmount)}</td> : null}
    </tr>)}
  </>
  if (data.kind === 'reservations') return <>
    {data.reservations.map((row) => <tr key={row.id}>
      <td data-label={t('dashboardReports.column.reservation')}><strong>#{row.id}</strong></td>
      <td data-label={t('dashboardReports.column.location')}><strong>{row.restaurantName}</strong><small>{row.tableName}</small></td>
      <td data-label={t('dashboardReports.column.date')}>{formatDashboardMoment(row.reservedAtUtc, locale, timezone)}</td>
      <td data-label={t('dashboardReports.column.status')}><ReservationStatus statusId={row.statusId} t={t} /></td>
      <td data-label={t('dashboardReports.column.arrival')}>{row.arrivedAtUtc ? <span>{t('dashboardReports.arrived')}: {formatDashboardMoment(row.arrivedAtUtc, locale, timezone)}</span> : '—'}
        {row.seatedAtUtc ? <small>{t('dashboardReports.seated')}: {formatDashboardMoment(row.seatedAtUtc, locale, timezone)}</small> : null}
      </td>
      <td data-label={t('dashboardReports.column.guests')} className="is-numeric">{formatters.number.format(row.peopleCount)}</td>
      <td data-label={t('dashboardReports.column.deposit')} className="is-numeric">{formatters.money.format(row.depositAmount)}</td>
    </tr>)}
  </>
  return <>
    {data.payments.map((row) => <tr key={`${row.event}:${row.id}`}>
      <td data-label={t('dashboardReports.column.event')}><span className={`role-dashboard-status${row.event === 'refund' ? ' is-warning' : ''}`}>{t(`dashboardReports.event.${row.event}`)}</span><small>#{row.id}</small></td>
      <td data-label={t('dashboardReports.column.restaurant')}><strong>{row.restaurantName}</strong></td>
      <td data-label={t('dashboardReports.column.date')}>{formatDashboardMoment(row.occurredAtUtc, locale, timezone)}</td>
      <td data-label={t('dashboardReports.column.purpose')}>{t(`dashboardReports.purpose.${row.purpose}`)}</td>
      <td data-label={t('dashboardReports.column.related')}><small>{row.reservationId ? `${t('dashboardReports.reservationShort')} #${row.reservationId}` : null}</small><small>{row.tableSessionId ? `${t('dashboardReports.sessionShort')} #${row.tableSessionId}` : null}</small>{!row.reservationId && !row.tableSessionId ? '—' : null}</td>
      <td data-label={t('dashboardReports.column.amount')} className="is-numeric"><strong>{formatters.money.format(row.amount)}</strong><small>{t(`dashboard.mode.${row.isTest ? 'test' : 'real'}`)}</small></td>
    </tr>)}
  </>
}

export function DashboardReports({ state, view, userId, kind, onKindChange, reloadKey, t, locale, formatters }: Props) {
  const [statusFilter, setStatusFilter] = useState<{ kind: DashboardReportKind; value: number | null }>({ kind: 'orders', value: null })
  const [paymentEvent, setPaymentEvent] = useState<DashboardPaymentEvent>('all')
  const [dayStartHour, setDayStartHour] = useState(0)
  const statusId = statusFilter.kind === kind ? statusFilter.value : null
  const report = useDashboardReportData(state, view, userId, kind, statusId, paymentEvent, dayStartHour, reloadKey, t)
  const data = report.data
  const statuses = kind === 'orders' ? orderStatuses : kind === 'reservations' ? reservationStatuses : []
  const visibleGroups = reportGroups.map((group) => ({ ...group, kinds: group.kinds.filter((option) => view !== 'manager' || !financialKinds.includes(option)) }))
    .filter((group) => group.kinds.length > 0)
  const totalPages = data ? Math.max(1, Math.ceil(data.totalRows / Math.max(1, data.pageSize))) : 1

  const rowCount = data?.detail ? data.detail.rows.length : data?.kind === 'orders' ? data.orders.length : data?.kind === 'reservations' ? data.reservations.length : data?.payments.length ?? 0
  const orderMetric = (key: string) => data?.metrics.find((metric) => metric.key === key)?.value
  const totalOrders = orderMetric('totalOrders')
  const pendingOrders = orderMetric('pendingOrders')
  const cancelledOrders = orderMetric('cancelledOrders')
  const showOrderStages = kind === 'orders' && totalOrders !== undefined && pendingOrders !== undefined && cancelledOrders !== undefined

  return <section className="role-dashboard-reports" aria-label={t('dashboardReports.title')}>
    <div className="role-dashboard-report-toolbar">
      <label className="role-dashboard-report-kind-select">{t('dashboardReports.kind')}
        <select value={kind} onChange={(event) => onKindChange(event.target.value as DashboardReportKind)}>
          {visibleGroups.map((group) => <optgroup key={group.key} label={t(`operationalReports.group.${group.key}`)}>
            {group.kinds.map((option) => <option key={option} value={option}>{reportLabel(option, t)}</option>)}
          </optgroup>)}
        </select>
      </label>
      {statuses.length ? <label className="role-dashboard-report-status-filter">{t('dashboardReports.status')}
        <select aria-label={t('dashboardReports.status')} value={statusId ?? ''} onChange={(event) => setStatusFilter({ kind, value: event.target.value ? Number(event.target.value) : null })}>
          <option value="">{t('dashboardReports.allStatuses')}</option>
          {statuses.map((option) => <option key={option.id} value={option.id}>{t(option.key)}</option>)}
        </select>
      </label> : null}
      {kind === 'payments' ? <fieldset className="role-dashboard-segments role-dashboard-report-events">
        <legend>{t('dashboardReports.eventFilter')}</legend>
        {(['all', 'receipt', 'refund'] as const).map((option) => <button key={option} type="button" aria-pressed={paymentEvent === option} onClick={() => setPaymentEvent(option)}>{t(`dashboardReports.event.${option}`)}</button>)}
      </fieldset> : null}
      {kind === 'payments' ? <label className="role-dashboard-report-mobile-select">{t('dashboardReports.eventFilter')}
        <select value={paymentEvent} onChange={(event) => setPaymentEvent(event.target.value as DashboardPaymentEvent)}>
          {(['all', 'receipt', 'refund'] as const).map((option) => <option key={option} value={option}>{t(`dashboardReports.event.${option}`)}</option>)}
        </select>
      </label> : null}
      <label className="role-dashboard-report-day-start">{t('operationalReports.dayStartHour')}
        <select value={dayStartHour} onChange={(event) => setDayStartHour(Number(event.target.value))}>
          {Array.from({ length: 13 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
        </select>
      </label>
      <button className="role-dashboard-report-export" type="button" disabled={!data || report.exporting || !state.canLoad} onClick={() => void report.download()}>
        <Download size={16} aria-hidden="true" />{report.exporting ? t('dashboardReports.exporting') : t('dashboardReports.export')}
      </button>
    </div>

    {report.exportError ? <StatusMessage tone="danger" autoHideMs={false}>{report.exportError}</StatusMessage> : null}
    {report.error && state.canLoad ? <StatusMessage tone="danger" autoHideMs={false}>{report.error}</StatusMessage> : null}
    {!data && report.loading ? <div className="role-dashboard-loading" role="status">{t('dashboardReports.loading')}</div> : null}

    {data ? <>
      <div className="role-dashboard-context">
        <CalendarDays size={15} aria-hidden="true" />{formatDateOnlyAz(data.from)} – {formatDateOnlyAz(data.to)}
        <span>{data.timeZone}</span>
        <span>{t('operationalReports.dayStartHour')}: {String(data.dayStartHour).padStart(2, '0')}:00</span>
        {financialKinds.includes(kind) ? <span>{t(`dashboard.mode.${data.paymentMode}`)}</span> : null}
        {report.loading ? <span role="status"><RefreshCw size={13} aria-hidden="true" />{t('dashboard.refreshing')}</span> : null}
      </div>
      <div className={`role-dashboard-report-summary${showOrderStages ? ' has-order-stages' : ''}`}>
      <ReportMetrics data={data} t={t} formatters={formatters} />
      {showOrderStages ? (
        <DashboardDonut title={t('dashboardReports.orderStages')} total={totalOrders}
          totalLabel={t('dashboardReports.ordersTotal')} totalFormatted={formatters.number.format(totalOrders)}
          emptyLabel={t('dashboardReports.noOrders')} note={t('dashboardReports.orderStagesNote')}
          parts={[
            { label: t('dashboardReports.metric.pendingOrders'), value: pendingOrders, formatted: formatters.number.format(pendingOrders), color: 'var(--dashboard-blue)' },
            { label: t('dashboardReports.metric.cancelledOrders'), value: cancelledOrders, formatted: formatters.number.format(cancelledOrders), color: 'var(--dashboard-red)' },
            { label: t('dashboardReports.otherStages'), value: totalOrders - pendingOrders - cancelledOrders, formatted: formatters.number.format(totalOrders - pendingOrders - cancelledOrders), color: 'var(--dashboard-teal)' },
          ]} />
      ) : null}
      </div>
      <div className="role-dashboard-report-head">
        <div><h2>{reportLabel(kind, t)}</h2><p>{t(operationalKinds.includes(kind) ? `operationalReports.caption.${kind}` : `dashboardReports.caption.${kind}`)}</p></div>
        <span>{t('dashboard.totalRows', { count: data.totalRows })}</span>
      </div>
      {rowCount > 0 && data.detail ? <OperationalReportTable detail={data.detail} timeZone={data.timeZone} locale={locale} formatters={formatters} t={t} /> : rowCount > 0 ? <div className="role-dashboard-report-table-scroll"><table>
        <thead><tr>
          {(kind === 'orders' ? ['order', 'location', 'date', 'status', 'itemUnits', 'originalSubtotal', ...(view === 'manager' ? [] : ['confirmedOrderAmount'])]
            : kind === 'reservations' ? ['reservation', 'location', 'date', 'status', 'arrival', 'guests', 'deposit']
              : ['event', 'restaurant', 'date', 'purpose', 'related', 'amount']).map((column) => <th key={column} scope="col"
                className={['itemUnits', 'originalSubtotal', 'confirmedOrderAmount', 'guests', 'deposit', 'amount'].includes(column) ? 'is-numeric' : undefined}>
                {t(`dashboardReports.column.${column}`)}
              </th>)}
        </tr></thead>
        <tbody><ReportRows data={data} view={view} t={t} locale={locale} formatters={formatters} /></tbody>
      </table></div> : <p className="role-dashboard-empty role-dashboard-report-empty">{t('dashboardReports.empty')}</p>}
      <PaginationControls ariaLabel={t('dashboardReports.pages')} pageIndex={data.pageIndex} totalPages={totalPages}
        hasPreviousPage={data.pageIndex > 1} hasNextPage={data.pageIndex < totalPages} onPageChange={report.setPageIndex} />
      {kind === 'orders' ? <p className="role-dashboard-report-footnote">{t('dashboardReports.originalSubtotalNote')}</p> : null}
      {kind === 'reservations' ? <p className="role-dashboard-report-footnote">{t('dashboardReports.depositNote')}</p> : null}
      {kind === 'payments' ? <p className="role-dashboard-report-footnote">{t('dashboardReports.paymentNote')}</p> : null}
      {operationalKinds.includes(kind) ? <p className="role-dashboard-report-footnote">{t(`operationalReports.note.${kind}`)}</p> : null}
      <p className="role-dashboard-report-updated">{t('dashboard.updated')}: {formatDashboardMoment(data.generatedAtUtc, locale, data.timeZone)}</p>
    </> : null}
  </section>
}
