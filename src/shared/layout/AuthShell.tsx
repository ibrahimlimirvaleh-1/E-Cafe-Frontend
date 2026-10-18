import { Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { LanguageSwitcher } from './LanguageSwitcher'

export function AuthShell() {
  return (
    <div className="auth-shell">
      <div className="auth-theme-switch">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  )
}
