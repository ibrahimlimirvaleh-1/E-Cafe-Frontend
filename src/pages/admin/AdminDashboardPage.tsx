import { CalendarDays, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DashboardReportKind } from '../../shared/api/dashboardApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { formatDateOnlyAz } from '../../shared/lib/dateFormatting'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { DashboardFilters } from './DashboardFilters'
import { DashboardReports } from './DashboardReports'
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
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview')
  const [reportKind, setReportKind] = useState<DashboardReportKind>('orders')
  const [reportReloadKey, setReportReloadKey] = useState(0)
  const state = useDashboardData(user, t, activeTab === 'overview')
  const locale = getDashboardLocale(i18n.resolvedLanguage)
  const formatters = useMemo(() => createDashboardFormatters(locale), [locale])
  const { view, data } = state
  const effectiveReportKind = view === 'manager' && reportKind === 'payments' ? 'orders' : reportKind

  useEffect(() => { setActiveTab('overview'); setReportKind('orders') }, [user?.userId, user?.roleId, user?.restaurantId])

  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = activeTab === 'overview' ? 'reports' : 'overview'
    setActiveTab(next)
    document.getElementById(`role-dashboard-tab-${next}`)?.focus()
  }

  return (
    <main className="admin-page role-dashboard">
      <header className="role-dashboard-heading">
        <div>
          <span className="role-dashboard-eyebrow">{t(activeTab === 'reports' ? 'dashboardReports.eyebrow' : `dashboard.eyebrow.${view || 'platform'}`)}</span>
          <h1>{t(activeTab === 'reports' ? 'dashboardReports.title' : `dashboard.title.${view || 'platform'}`)}</h1>
          <p>{t(activeTab === 'reports' ? `dashboardReports.subtitle.${view || 'platform'}` : `dashboard.subtitle.${view || 'platform'}`)}</p>
        </div>
        <button
          className="role-dashboard-refresh"
          type="button"
          onClick={() => activeTab === 'overview' ? state.refresh() : setReportReloadKey((value) => value + 1)}
          aria-label={t('dashboard.refresh')}
          title={t('dashboard.refresh')}
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </header>

      <div className="role-dashboard-view-tabs" role="tablist" aria-label={t('dashboardReports.views')}>
        {(['overview', 'reports'] as const).map((tab) => <button key={tab} id={`role-dashboard-tab-${tab}`}
          role="tab" type="button" aria-selected={activeTab === tab} aria-controls={`role-dashboard-panel-${tab}`}
          tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={onTabKeyDown}>
          {t(`dashboardReports.view.${tab}`)}
        </button>)}
      </div>

      <DashboardFilters state={state} user={user} t={t} showPaymentMode={activeTab === 'overview' || effectiveReportKind === 'payments'} />

      {view === 'manager' && !state.hasManagerScope ? (
        <StatusMessage tone="warning" autoHideMs={false}>{t('dashboard.noRestaurant')}</StatusMessage>
      ) : null}
      {activeTab === 'overview' && state.error ? <StatusMessage tone="danger" autoHideMs={false}>{state.error}</StatusMessage> : null}
      {activeTab === 'overview' && !data && state.loading && state.canLoad ? (
        <div className="role-dashboard-loading" role="status">{t('dashboard.loading')}</div>
      ) : null}

      {activeTab === 'overview' && data && view ? (
        <div id="role-dashboard-panel-overview" role="tabpanel" aria-labelledby="role-dashboard-tab-overview">
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
        </div>
      ) : null}
      {activeTab === 'reports' && view && (view !== 'manager' || state.hasManagerScope) ? <div id="role-dashboard-panel-reports" role="tabpanel" aria-labelledby="role-dashboard-tab-reports">
        <DashboardReports state={state} view={view} userId={user?.userId} kind={effectiveReportKind} onKindChange={setReportKind}
          reloadKey={reportReloadKey} t={t} locale={locale} formatters={formatters} />
      </div> : null}
    </main>
  )
}
