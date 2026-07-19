import { Outlet } from 'react-router-dom'
import { Brand } from './Brand'

type StaffShellProps = {
  title: string
}

export function StaffShell({ title }: StaffShellProps) {
  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <Brand />
        <strong>{title}</strong>
      </header>
      <Outlet />
    </div>
  )
}
