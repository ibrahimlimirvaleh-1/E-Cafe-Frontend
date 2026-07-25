import { Outlet } from 'react-router-dom'
import { Brand } from './Brand'
import { UserMenu } from './UserMenu'

type StaffShellProps = {
  title: string
}

export function StaffShell({ title }: StaffShellProps) {
  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <Brand />
        <strong>{title}</strong>
        <UserMenu />
      </header>
      <Outlet />
    </div>
  )
}
