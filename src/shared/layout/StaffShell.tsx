import { NavLink, Outlet } from 'react-router-dom'
import { Brand } from './Brand'
import { UserMenu } from './UserMenu'
import { useAuth } from '../auth/AuthContext'

type StaffShellProps = {
  title: string
}

export function StaffShell({ title }: StaffShellProps) {
  const { user } = useAuth()
  const isKitchen = user?.roleId === '6'
  const isWaiter = user?.roleId === '4'

  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <Brand />
        <strong>{title}</strong>
        <nav className="staff-nav">
          {isKitchen ? (
            <>
              <NavLink end to="/kitchen">Sifarişlər</NavLink>
              <NavLink to="/kitchen/inventory">Stok və resept</NavLink>
            </>
          ) : null}
          {isWaiter ? (
            <>
              <NavLink end to="/waiter">Panel</NavLink>
              <NavLink to="/waiter/orders">Sifarişlər</NavLink>
            </>
          ) : null}
        </nav>
        <UserMenu />
      </header>
      <Outlet />
    </div>
  )
}
