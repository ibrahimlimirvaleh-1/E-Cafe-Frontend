import { CheckCircle2, Table2, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { PageIntro } from '../../components/PageIntro'
import { Stepper } from '../../components/Stepper'
import { menuItems, reservationTables, waiters } from '../../data/mockData'

export function TableSelection() {
  return (
    <section className="page flow-page">
      <Stepper active={1} />
      <PageIntro title="Masa seçimi" text="Uyğun masa tipini seç və rezervasiya saatını təsdiqlə." />
      <div className="option-grid">
        {reservationTables.map((table) => (
          <NavLink className="selection-card" to="/reserve/waiter" key={table.id}>
            <Table2 size={24} />
            <strong>{table.label}</strong>
            <span>{table.detail}</span>
            <small>{table.note}</small>
          </NavLink>
        ))}
      </div>
    </section>
  )
}

export function WaiterSelection() {
  return (
    <section className="page flow-page">
      <Stepper active={2} />
      <PageIntro title="Ofisiant seçimi" text="İstəsən rezervasiyaya məsul olacaq ofisiantı seç." />
      <div className="option-grid">
        {waiters.map((waiter) => (
          <NavLink className="selection-card" to="/reserve/menu" key={waiter.id}>
            <Users size={24} />
            <strong>{waiter.label}</strong>
            <span>{waiter.detail}</span>
            <small>{waiter.note}</small>
          </NavLink>
        ))}
      </div>
    </section>
  )
}

export function MenuSelection() {
  return (
    <section className="page flow-page">
      <Stepper active={3} />
      <PageIntro title="Menyu seçimi" text="Pre-order üçün yeməkləri səbətə əlavə et." />
      <div className="split-layout">
        <div className="menu-list">
          {menuItems.map((item) => (
            <article className="menu-row" key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.category}</span>
              </div>
              <div>
                <b>₼{item.price}</b>
                <button type="button">Əlavə et</button>
              </div>
            </article>
          ))}
        </div>
        <aside className="summary-panel">
          <h2>Səbət xülasəsi</h2>
          <p>2 məhsul, masa T-104, saat 20:30</p>
          <strong>₼55.00</strong>
          <NavLink className="primary-button full" to="/checkout">
            Ödənişə keç
          </NavLink>
        </aside>
      </div>
    </section>
  )
}

export function Checkout() {
  return (
    <section className="page flow-page">
      <Stepper active={4} />
      <PageIntro title="Ödəniş" text="Rezervasiya və pre-order məbləğini Payriff ilə tamamla." />
      <div className="checkout-grid">
        <div className="form-panel">
          <label>
            Kart sahibi
            <input defaultValue="Aysel Məmmədova" />
          </label>
          <label>
            Kart nömrəsi
            <input defaultValue="4242 4242 4242 4242" />
          </label>
          <div className="form-row">
            <label>
              Tarix
              <input defaultValue="12/28" />
            </label>
            <label>
              CVV
              <input defaultValue="123" />
            </label>
          </div>
          <NavLink className="primary-button full" to="/confirmation">
            Ödənişi təsdiqlə
          </NavLink>
        </div>
        <aside className="summary-panel">
          <h2>Rezervasiya</h2>
          <p>Saffron Premium Lounge</p>
          <p>Masa T-104, 2 nəfər, 20:30</p>
          <strong>₼55.00</strong>
        </aside>
      </div>
    </section>
  )
}

export function Confirmation() {
  return (
    <section className="page centered-page">
      <div className="success-card">
        <CheckCircle2 size={52} />
        <h1>Rezervasiya təsdiqləndi</h1>
        <p>Ödəniş uğurludur. Rezervasiya kodun: RSV-2045.</p>
        <NavLink className="primary-button" to="/reservations">
          Rezervasiyalarımı göstər
        </NavLink>
      </div>
    </section>
  )
}

export function MyReservations() {
  return (
    <section className="page flow-page">
      <PageIntro title="Rezervasiyalarım" text="Aktiv və keçmiş rezervasiyalarını buradan izlə." />
      <div className="table-card">
        {['Saffron Premium Lounge', 'Lumina Cafe'].map((name, index) => (
          <div className="table-row" key={name}>
            <span>{name}</span>
            <span>{index === 0 ? 'Bu gün, 20:30' : '20 iyul, 18:00'}</span>
            <span className={index === 0 ? 'status success' : 'status warning'}>
              {index === 0 ? 'Təsdiqləndi' : 'Gözləmədə'}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
