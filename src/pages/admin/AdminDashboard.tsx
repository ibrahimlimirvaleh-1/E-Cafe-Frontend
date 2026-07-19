import type { ReactNode } from 'react'
import { MetricCard } from '../../components/MetricCard'
import { PageIntro } from '../../components/PageIntro'
import { adminMetrics, adminModules } from '../../data/mockData'

export function AdminDashboard() {
  return (
    <section className="admin-page">
      <PageIntro title="İdarəetmə paneli" text="Rezervasiya, sifariş, ödəniş və cüzdan vəziyyətini izləyin." />
      <div className="metric-grid">
        {adminMetrics.map((metric) => (
          <MetricCard metric={metric} key={metric.label} />
        ))}
      </div>
      <div className="module-grid">
        {adminModules.map((module) => {
          const Icon = module.icon
          return (
            <article className="module-card" key={module.name}>
              <Icon size={22} />
              <div>
                <strong>{module.name}</strong>
                <span>{module.count}</span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function AdminList({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <section className="admin-page">
      <PageIntro title={title} text={`${title} modulunda siyahı, filter, detal və əməliyyatlar görünəcək.`} />
      <div className="table-card">
        {[1, 2, 3, 4].map((item) => (
          <div className="table-row" key={item}>
            <span className="row-title">
              {icon}
              {title} #{item}
            </span>
            <span>Son yenilənmə: bu gün</span>
            <span className={item % 2 === 0 ? 'status warning' : 'status success'}>
              {item % 2 === 0 ? 'Gözləmədə' : 'Aktiv'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
