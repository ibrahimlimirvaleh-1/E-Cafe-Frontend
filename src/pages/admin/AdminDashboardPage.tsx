import { i18n } from '../../shared/i18n/i18n'
import { ShieldCheck, WalletCards } from 'lucide-react'
import { adminModules, contracts, orders, payments, reservations, settlements } from '../../entities/mockData'
import { localizeAdminModule } from '../../entities/mockData'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

const metrics = [
  { labelKey: 'ui.adminMetric.todayReservations', value: reservations.length.toString() },
  { labelKey: 'ui.adminMetric.activeOrders', value: orders.length.toString() },
  { labelKey: 'ui.adminMetric.demoPayments', value: `${payments.reduce((sum, item) => sum + item.amount, 0).toFixed(2)} ₼` },
  { labelKey: 'ui.adminMetric.demoSettlements', value: `${settlements.reduce((sum, item) => sum + item.payableAmount, 0).toFixed(2)} ₼` },
]

export function AdminDashboardPage() {
  useTranslation()
  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.admin_dashboard_page.platform_admin_654fc8')}
        title={i18n.t('ui.pages.admin.admin_dashboard_page.ecafe_idareetme_paneli_2836c3')}
      />

      <section className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.labelKey}>
            <span>{i18n.t(metric.labelKey)}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-alert-grid">
        <article className="business-alert">
          <ShieldCheck size={24} />
          <div>
            <strong>{i18n.t('ui.pages.admin.admin_dashboard_page.contract_gate_ac08e5')}</strong>
            <p>{i18n.t('ui.admin.contractCount', { count: contracts.filter((contract) => contract.status === 'Active').length })}</p>
          </div>
        </article>
        <article className="business-alert">
          <WalletCards size={24} />
          <div>
            <strong>{i18n.t('ui.pages.admin.admin_dashboard_page.odenis_hazirligi_1566ce')}</strong>
            <p>{i18n.t('ui.pages.admin.admin_dashboard_page.bu_paneldeki_maliyye_reqemleri_demo_me_8fb0ee')}</p>
          </div>
        </article>
      </section>

      <section className="module-grid">
        {adminModules.map(localizeAdminModule).map((module) => (
          <ButtonLink className="module-card" key={module.key} to={module.route} variant="secondary">
            <module.icon size={22} />
            <span>
              <strong>{module.title}</strong>
              <small>{module.description}</small>
            </span>
          </ButtonLink>
        ))}
      </section>
    </main>
  )
}
