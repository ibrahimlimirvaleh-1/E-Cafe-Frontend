import { Clock3 } from 'lucide-react'
import { PageIntro } from '../../components/PageIntro'

export function WaiterDashboard() {
  return (
    <section className="page waiter-page">
      <PageIntro title="Ofisiant paneli" text="Bu gün sənə təyin olunmuş masaları və sifarişləri idarə et." />
      <div className="metric-grid">
        <article className="metric-card info">
          <span>Rezervasiyalar</span>
          <strong>8</strong>
          <small>3-ü növbəti saatdadır</small>
        </article>
        <article className="metric-card warning">
          <span>Gözləyən sifariş</span>
          <strong>5</strong>
          <small>Mətbəxdə hazırlanır</small>
        </article>
        <article className="metric-card success">
          <span>Aktiv masalar</span>
          <strong>12</strong>
          <small>2 masa hesab istəyir</small>
        </article>
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
          <p>Masa T-104 üçün pre-order təsdiqini mətbəxə ötür.</p>
          <button className="primary-button full" type="button">
            Statusu yenilə
          </button>
        </aside>
      </div>
    </section>
  )
}
