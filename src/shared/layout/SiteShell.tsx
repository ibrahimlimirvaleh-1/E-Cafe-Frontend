import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, isInRole } from '../auth/authz'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useTranslation } from 'react-i18next'

export function SiteShell() {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const isCustomer = isInRole(user, [RoleIds.Customer])
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const alignActive = () => {
      const nav = navRef.current
      if (!nav || nav.scrollWidth <= nav.clientWidth) return
      const active = nav.querySelector<HTMLElement>('a.active')
      if (!active) return
      nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.clientWidth) / 2
    }
    alignActive()
    window.addEventListener('resize', alignActive)
    return () => window.removeEventListener('resize', alignActive)
  }, [pathname, isCustomer])

  return (
    <div className="app-shell">
      <header className="site-topbar">
        <div className="site-topbar-inner">
          <Brand />
          {isAuthenticated && isCustomer ? (
            <nav className="site-nav" aria-label={t('ui.nav.site')} ref={navRef}>
              <NavLink to="/">{t('ui.nav.restaurants')}</NavLink>
              <NavLink to="/reservations">{t('ui.nav.myReservations')}</NavLink>
              <NavLink to="/orders">{t('ui.nav.myOrders')}</NavLink>
              <NavLink to="/mobile-app">{t('ui.nav.androidApp')}</NavLink>
              <NavLink to="/tracking/demo-token">{t('ui.nav.tracking')}</NavLink>
            </nav>
          ) : null}
          <div className="site-actions">
            <LanguageSwitcher />
            <ThemeToggle />
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
