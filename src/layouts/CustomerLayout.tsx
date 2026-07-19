import { Bell } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'

export function CustomerLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Logo />
        <nav className="site-nav" aria-label="Əsas keçidlər">
          <NavLink to="/">Restoranlar</NavLink>
          <NavLink to="/reservations">Rezervasiyalarım</NavLink>
          <NavLink to="/admin">Admin</NavLink>
          <NavLink to="/waiter">Ofisiant</NavLink>
        </nav>
        <NavLink className="ghost-button" to="/reservations">
          <Bell size={18} />
          Bildirişlər
        </NavLink>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
