import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, isInRole } from '../auth/authz'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useTranslation } from 'react-i18next'

type StaffShellProps = {
  title: string
  variant: 'kitchen' | 'waiter'
}

export function StaffShell({ title, variant }: StaffShellProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const isKitchen = isInRole(user, [RoleIds.Kitchen])
  const isWaiter = isInRole(user, [RoleIds.Waiter])
  const isWaiterShell = variant === 'waiter'
  const headerContent = <>
    <Brand />
    {!isWaiterShell ? <strong>{title}</strong> : null}
    <nav className={isWaiterShell ? 'site-nav' : 'staff-nav'} aria-label={t('ui.nav.work')}>
      {!isWaiterShell && isKitchen ? (
        <>
          <NavLink end to="/kitchen">{t('ui.nav.orders')}</NavLink>
          <NavLink to="/kitchen/inventory">{t('ui.nav.stock')}</NavLink>
          <NavLink to="/kitchen/recipes">{t('ui.nav.recipes')}</NavLink>
        </>
      ) : null}
      {isWaiterShell && isWaiter ? (
        <>
          <NavLink end to="/waiter">{t('ui.nav.panel')}</NavLink>
          <NavLink to="/waiter/orders" className={({ isActive }) => isActive || /^\/waiter\/restaurants\/\d+\/sessions\/\d+\/orders$/.test(location.pathname) ? 'active' : ''}>{t('ui.nav.orders')}</NavLink>
        </>
      ) : null}
    </nav>
    <div className="site-actions">
      <LanguageSwitcher />
      <ThemeToggle />
      <WorkspaceSwitcher mode="workspace" />
      <NotificationBell />
      <UserMenu />
    </div>
  </>

  return (
    <div className="staff-shell">
      <header className={isWaiterShell ? 'site-topbar' : 'staff-topbar'}>
        <div className={isWaiterShell ? 'site-topbar-inner' : 'staff-topbar-inner'}>
          {headerContent}
        </div>
      </header>
      <div className="route-transition">
        <Outlet />
      </div>
    </div>
  )
}
