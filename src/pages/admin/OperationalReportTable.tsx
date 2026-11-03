import type { DashboardReportDetail } from '../../shared/api/dashboardApi'
import { formatDashboardMoment, type DashboardFormatters, type DashboardTranslate } from './dashboardFormatting'

type Props = {
  detail: DashboardReportDetail
  timeZone: string
  locale: string
  formatters: DashboardFormatters
  t: DashboardTranslate
}

const productCostColumns = new Set(['ingredientCost', 'grossProfit', 'averageIngredientCost'])

function cellValue(
  cell: DashboardReportDetail['rows'][number]['cells'][number] | undefined,
  format: DashboardReportDetail['columns'][number]['format'],
  { timeZone, locale, formatters, t }: Props,
) {
  if (!cell) return '—'
  if (format === 'datetime') return cell.utc ? formatDashboardMoment(cell.utc, locale, timeZone) : '—'
  if (format === 'code') return cell.text ? t(`operationalReports.value.${cell.text}`, { defaultValue: cell.text }) : '—'
  if (format === 'text') return cell.text || '—'
  if (cell.number === null) return '—'
  if (format === 'currency') return formatters.money.format(cell.number)
  if (format === 'minutes') return `${formatters.preciseNumber.format(cell.number)} ${t('operationalReports.unit.minutes')}`
  if (format === 'percent') return `${formatters.preciseNumber.format(cell.number)}%`
  return formatters.preciseNumber.format(cell.number)
}

export function OperationalReportTable(props: Props) {
  const { detail, t } = props
  const soldIndex = detail.columns.findIndex(({ key }) => key === 'sold')
  const hasProductCosts = soldIndex >= 0 && detail.columns.some(({ key }) => key === 'ingredientCost')
  const label = (key: string) => t(`operationalReports.column.${hasProductCosts && key === 'deliveredAmount' ? 'servedSalesAmount' : key}`, { defaultValue: key })
  return <div className="role-dashboard-report-table-scroll"><table>
    <thead><tr>{detail.columns.map((column) => <th key={column.key} scope="col"
      className={['number', 'currency', 'minutes', 'percent'].includes(column.format) ? 'is-numeric' : undefined}>
      {label(column.key)}
    </th>)}</tr></thead>
    <tbody>{detail.rows.map((row) => <tr key={row.id}>
      {detail.columns.map((column, index) => <td key={column.key} data-label={label(column.key)}
        className={['number', 'currency', 'minutes', 'percent'].includes(column.format) ? 'is-numeric' : undefined}>
        {hasProductCosts && productCostColumns.has(column.key)
          && (row.cells[soldIndex]?.number ?? 0) > 0 && row.cells[index]?.number == null
          ? <span className="role-dashboard-report-cost-unknown">{t('operationalReports.productCostUnknown')}</span>
          : cellValue(row.cells[index], column.format, props)}
      </td>)}
    </tr>)}</tbody>
  </table></div>
}
