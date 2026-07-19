import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'

export function WaiterLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Logo />
        <nav className="site-nav" aria-label="Ofisiant keçidləri">
          <NavLink to="/waiter">Panel</NavLink>
          <NavLink to="/">Müştəri səhifəsi</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
