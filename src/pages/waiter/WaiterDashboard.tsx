import { useState } from 'react'
import { Clock3 } from 'lucide-react'
import { MetricCard } from '../../components/MetricCard'
import { PageIntro } from '../../components/PageIntro'
import { waiterMetrics } from '../../data/mockData'

export function WaiterDashboard() {
  const [isKitchenNotified, setIsKitchenNotified] = useState(false)

  return (
    <section className="page waiter-page">
      <PageIntro title="Ofisiant paneli" text="Bu gün sənə təyin olunmuş masaları və sifarişləri idarə et." />
      <div className="metric-grid">
        {waiterMetrics.map((metric) => (
          <MetricCard metric={metric} key={metric.label} />
        ))}
      </div>
      <div className="split-layout">
        <div className="table-card">
          {['Masa T-104', 'VIP-2', 'Terrace-8'].map((table) => (
            <div className="table-row" key={table}>
              <span>{table}</span>
              <span>Rezervasiya: 20:30</span>
              <span className="status warning">Diqqət</span>
            </div>
          ))}
        </div>
        <aside className="summary-panel">
          <Clock3 size={28} />
          <h2>Növbəti addım</h2>
          <p>
            {isKitchenNotified
              ? 'Masa T-104 pre-order təsdiqi mətbəxə ötürüldü.'
              : 'Masa T-104 üçün pre-order təsdiqini mətbəxə ötür.'}
          </p>
          <button className="primary-button full" type="button" onClick={() => setIsKitchenNotified(true)}>
            {isKitchenNotified ? 'Status yeniləndi' : 'Statusu yenilə'}
          </button>
        </aside>
      </div>
    </section>
  )
}
