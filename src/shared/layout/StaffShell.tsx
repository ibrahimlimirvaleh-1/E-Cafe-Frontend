import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, isInRole } from '../auth/authz'

type StaffShellProps = {
  title: string
  variant: 'kitchen' | 'waiter'
}

export function StaffShell({ title, variant }: StaffShellProps) {
  const { user } = useAuth()
  const location = useLocation()
  const isKitchen = isInRole(user, [RoleIds.Kitchen])
  const isWaiter = isInRole(user, [RoleIds.Waiter])
  const isWaiterShell = variant === 'waiter'
  const headerContent = <>
    <Brand />
    {!isWaiterShell ? <strong>{title}</strong> : null}
    <nav className={isWaiterShell ? 'site-nav' : 'staff-nav'} aria-label="İş paneli naviqasiyası">
      {!isWaiterShell && isKitchen ? (
        <>
          <NavLink end to="/kitchen">Sifarişlər</NavLink>
          <NavLink to="/kitchen/inventory">Stok</NavLink>
          <NavLink to="/kitchen/recipes">Reseptlər</NavLink>
        </>
      ) : null}
      {isWaiterShell && isWaiter ? (
        <>
          <NavLink end to="/waiter">Panel</NavLink>
          <NavLink to="/waiter/orders" className={({ isActive }) => isActive || /^\/waiter\/restaurants\/\d+\/sessions\/\d+\/orders$/.test(location.pathname) ? 'active' : ''}>Sifarişlər</NavLink>
        </>
      ) : null}
    </nav>
    <div className="site-actions">
      <ThemeToggle />
      <WorkspaceSwitcher mode="workspace" />
      <NotificationBell />
      <UserMenu />
    </div>
  </>

  return (
    <div className="staff-shell">
      <header className={isWaiterShell ? 'site-topbar' : 'staff-topbar'}>
        {isWaiterShell ? <div className="site-topbar-inner">{headerContent}</div> : headerContent}
      </header>
      <div className="route-transition">
        <Outlet />
      </div>
    </div>
  )
}
