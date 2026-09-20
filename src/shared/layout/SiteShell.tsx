import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, isInRole } from '../auth/authz'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

export function SiteShell() {
  const { isAuthenticated, user } = useAuth()
  const isCustomer = isInRole(user, [RoleIds.Customer])

  return (
    <div className="app-shell">
      <header className="site-topbar">
        <div className="site-topbar-inner">
          <Brand />
          {isAuthenticated && isCustomer ? (
            <nav className="site-nav" aria-label="Sayt naviqasiyası">
              <NavLink to="/">Restoranlar</NavLink>
              <NavLink to="/reservations">Rezervasiyalarım</NavLink>
              <NavLink to="/orders">Sifarişlərim</NavLink>
              <NavLink to="/tracking/demo-token">İzləmə</NavLink>
            </nav>
          ) : null}
          <div className="site-actions">
            <WorkspaceSwitcher mode="site" />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="route-transition">
        <Outlet />
      </div>
    </div>
  )
}
