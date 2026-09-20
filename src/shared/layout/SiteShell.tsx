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
          {isAuthenticated ? (
            <nav className="site-nav" aria-label="Sayt naviqasiyası">
              <NavLink to="/">Restoranlar</NavLink>
              {isCustomer ? <NavLink to="/reservations">Rezervasiyalarım</NavLink> : null}
              {isCustomer ? <NavLink to="/orders">Sifarişlərim</NavLink> : null}
              {isCustomer ? <NavLink to="/tracking/demo-token">İzləmə</NavLink> : null}
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
