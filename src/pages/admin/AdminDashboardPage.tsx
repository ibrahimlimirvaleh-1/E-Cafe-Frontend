import { ShieldCheck, WalletCards } from 'lucide-react'
import { adminModules, contracts, orders, payments, reservations, settlements } from '../../entities/mockData'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

const metrics = [
  { label: 'Bugünkü rezervasiya', value: reservations.length.toString(), hint: 'Depozitlə təsdiqlənən rezervlər' },
  { label: 'Aktiv sifariş', value: orders.length.toString(), hint: 'Ofisiant tərəfindən yaradılan sifarişlər' },
  { label: 'Online ödəniş', value: `${payments.reduce((sum, item) => sum + item.amount, 0).toFixed(2)} ₼`, hint: 'Yalnız sistemdə izlənən ödənişlər' },
  { label: 'Personal qazancı', value: `${settlements.reduce((sum, item) => sum + item.payableAmount, 0).toFixed(2)} ₼`, hint: 'Ödəniş dövrünə düşən məbləğ' },
]

export function AdminDashboardPage() {
  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Platform Admin"
        title="ECafe idarəetmə paneli"
        description="Restoran müqavilələri, rezervasiyalar, sifarişlər və ödənişlər bir paneldə idarə olunur."
      />

      <section className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.hint}</small>
          </article>
        ))}
      </section>

      <section className="admin-alert-grid">
        <article className="business-alert">
          <ShieldCheck size={24} />
          <div>
            <strong>Contract gate</strong>
            <p>{contracts.filter((contract) => contract.status === 'Active').length} restoran aktiv müqavilə ilə rezervasiya qəbul edir.</p>
          </div>
        </article>
        <article className="business-alert">
          <WalletCards size={24} />
          <div>
            <strong>Online-only payment</strong>
            <p>Ödənişlər yalnız online izlənir; nağd bağlama aktiv deyil.</p>
          </div>
        </article>
      </section>

      <section className="module-grid">
        {adminModules.map((module) => (
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
