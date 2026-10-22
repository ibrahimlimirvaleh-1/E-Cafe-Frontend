import { CalendarDays, RefreshCw } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../shared/auth/AuthContext'
import { formatDateOnlyAz } from '../../shared/lib/dateFormatting'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { DashboardFilters } from './DashboardFilters'
import { DashboardAlerts, DashboardChart, DashboardFinancials, DashboardMetrics, DashboardTable } from './DashboardSections'
import { createDashboardFormatters, getDashboardLocale } from './dashboardFormatting'
import { useDashboardData } from './useDashboardData'
import './admin-dashboard.css'

export function AdminDashboardPage() {
  const { t: translate, i18n } = useTranslation()
  const t = useCallback(
    (key: string, options?: { count?: number; defaultValue?: string }) => translate(`ui.${key}`, options),
    [translate],
  )
  const { user } = useAuth()
  const state = useDashboardData(user, t)
  const locale = getDashboardLocale(i18n.resolvedLanguage)
  const formatters = useMemo(() => createDashboardFormatters(locale), [locale])
  const { view, data } = state

  return (
    <main className="admin-page role-dashboard">
      <header className="role-dashboard-heading">
        <div>
          <span className="role-dashboard-eyebrow">{t(`dashboard.eyebrow.${view || 'platform'}`)}</span>
          <h1>{t(`dashboard.title.${view || 'platform'}`)}</h1>
          <p>{t(`dashboard.subtitle.${view || 'platform'}`)}</p>
        </div>
        <button
          className="role-dashboard-refresh"
          type="button"
          onClick={state.refresh}
          aria-label={t('dashboard.refresh')}
          title={t('dashboard.refresh')}
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </header>

      <DashboardFilters state={state} user={user} t={t} />

      {view === 'manager' && !state.canLoad ? (
        <StatusMessage tone="warning" autoHideMs={false}>{t('dashboard.noRestaurant')}</StatusMessage>
      ) : null}
      {state.error ? <StatusMessage tone="danger" autoHideMs={false}>{state.error}</StatusMessage> : null}
      {!data && state.loading && state.canLoad ? (
        <div className="role-dashboard-loading" role="status">{t('dashboard.loading')}</div>
      ) : null}

      {data && view ? (
        <>
          <div className="role-dashboard-context">
            <CalendarDays size={15} aria-hidden="true" />
            {formatDateOnlyAz(data.from)} – {formatDateOnlyAz(data.to)}
            <span>{data.timeZone}</span>
            {state.loading ? <span>{t('dashboard.refreshing')}</span> : null}
          </div>

          <DashboardMetrics data={data} view={view} t={t} locale={locale} formatters={formatters} />

          <div className="role-dashboard-main-grid">
            <DashboardChart data={data} t={t} locale={locale} formatters={formatters} />
            <DashboardAlerts data={data} t={t} />
          </div>

          {view !== 'manager' ? (
            <DashboardFinancials data={data} t={t} locale={locale} formatters={formatters} />
          ) : null}

          <DashboardTable
            data={data}
            view={view}
            t={t}
            locale={locale}
            formatters={formatters}
            onPageChange={state.setPageIndex}
          />
        </>
      ) : null}
    </main>
  )
}
