import {
  CalendarDays,
  CircleDollarSign,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Store,
  WalletCards,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'

export function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          <NavLink to="/admin" end>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          <NavLink to="/admin/restaurants">
            <Store size={18} />
            Restoranlar
          </NavLink>
          <NavLink to="/admin/reservations">
            <CalendarDays size={18} />
            Rezervasiyalar
          </NavLink>
          <NavLink to="/admin/payments">
            <WalletCards size={18} />
            Ödənişlər
          </NavLink>
          <NavLink to="/admin/wallet">
            <CircleDollarSign size={18} />
            Cüzdan
          </NavLink>
          <NavLink to="/admin/settings">
            <Settings size={18} />
            Ayarlar
          </NavLink>
        </nav>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span>Restoran sahibi paneli</span>
            <strong>Saffron Premium Lounge</strong>
          </div>
          <button className="ghost-button" type="button">
            <ShieldCheck size={18} />
            Owner
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
