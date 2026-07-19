import { Bell, Search } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Brand } from './Brand'

export function SiteShell() {
  return (
    <div className="app-shell">
      <header className="site-topbar">
        <div className="site-topbar-inner">
          <Brand />
          <nav className="site-nav" aria-label="Sayt naviqasiyası">
            <NavLink to="/">Restoranlar</NavLink>
            <NavLink to="/reservations">Rezervasiyalarım</NavLink>
            <NavLink to="/orders">Sifarişlərim</NavLink>
            <NavLink to="/tracking/demo-token">Tracking</NavLink>
          </nav>
          <label className="site-search">
            <Search size={18} />
            <input placeholder="Restoran axtar..." />
          </label>
          <div className="site-actions">
            <Link className="icon-action" to="/notifications" title="Bildirişlər">
              <Bell size={18} />
            </Link>
            <Link className="ui-button ui-button-primary compact" to="/login">
              Daxil ol
            </Link>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
