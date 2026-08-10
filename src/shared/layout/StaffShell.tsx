import { NavLink, Outlet } from 'react-router-dom'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, isInRole } from '../auth/authz'

type StaffShellProps = {
  title: string
}

export function StaffShell({ title }: StaffShellProps) {
  const { user } = useAuth()
  const isKitchen = isInRole(user, [RoleIds.Kitchen])
  const isWaiter = isInRole(user, [RoleIds.Waiter])

  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <Brand />
        <strong>{title}</strong>
        <nav className="staff-nav">
          {isKitchen ? (
            <>
              <NavLink end to="/kitchen">Sifarişlər</NavLink>
              <NavLink to="/kitchen/inventory">Stok</NavLink>
              <NavLink to="/kitchen/recipes">Reseptlər</NavLink>
            </>
          ) : null}
          {isWaiter ? (
            <>
              <NavLink end to="/waiter">Panel</NavLink>
              <NavLink to="/waiter/orders">Sifarişlər</NavLink>
            </>
          ) : null}
        </nav>
        <div className="site-actions">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>
      <Outlet />
    </div>
  )
}
