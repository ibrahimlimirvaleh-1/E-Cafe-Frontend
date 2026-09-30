import { Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

export function AuthShell() {
  return (
    <div className="auth-shell">
      <div className="auth-theme-switch">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  )
}
