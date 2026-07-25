import { Bell } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Brand } from './Brand'
import { UserMenu } from './UserMenu'

export function SiteShell() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="app-shell">
      <header className="site-topbar">
        <div className="site-topbar-inner">
          <Brand />
          {isAuthenticated ? (
            <nav className="site-nav" aria-label="Sayt naviqasiyası">
              <NavLink to="/">Restoranlar</NavLink>
              <NavLink to="/reservations">Rezervasiyalarım</NavLink>
              <NavLink to="/orders">Sifarişlərim</NavLink>
              <NavLink to="/tracking/demo-token">İzləmə</NavLink>
            </nav>
          ) : null}
          <div className="site-actions">
            {isAuthenticated ? (
              <Link className="icon-action" to="/notifications" title="Bildirişlər">
                <Bell size={18} />
              </Link>
            ) : null}
            <UserMenu />
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
