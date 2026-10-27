import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Languages, LayoutDashboard, MailWarning, Menu, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminModules, localizeAdminModule } from '../../entities/mockData'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, isInRole } from '../auth/authz'
import { canAccessAdminModule } from '../config/adminPermissions'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useTranslation } from 'react-i18next'

const outboxAdminModule = {
  permissionKey: 'audit-logs',
  title: 'Sistem mesajları',
  route: '/admin/outbox',
  icon: MailWarning,
} as const

const sidebarPreferenceKey = 'ecafe.admin.sidebar.collapsed'

function readSidebarPreference() {
  try {
    return window.localStorage.getItem(sidebarPreferenceKey) === 'true'
  } catch {
    return false
  }
}

export function AdminShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [collapsed, setCollapsed] = useState(readSidebarPreference)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1080px)').matches)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const configuredModules = [
    ...adminModules.map((module) => ({ ...localizeAdminModule(module), permissionKey: module.key })),
    outboxAdminModule,
  ]
  const modules = configuredModules.filter((module) => canAccessAdminModule(user, module.permissionKey))
  const isPlatformAdmin = isInRole(user, [RoleIds.PlatformAdmin])
  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus())
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1080px)')
    const update = () => {
      setMobile(media.matches)
      if (!media.matches) setDrawerOpen(false)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobile || !drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
      }
      if (event.key !== 'Tab') return
      const focusable = [...(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])]
        .filter((element) => element.getClientRects().length > 0)
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !sidebarRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !sidebarRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobile, drawerOpen, closeDrawer])

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem(sidebarPreferenceKey, String(next))
      } catch {
        // Keep the preference for this page even when storage is unavailable.
      }
      return next
    })
  }

  function navLabel(label: string) {
    return {
      'aria-label': !mobile && collapsed ? label : undefined,
      title: !mobile && collapsed ? label : undefined,
      onClick: () => { if (mobile) closeDrawer() },
    }
  }

  return (
    <div className={`admin-shell${collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      {mobile && drawerOpen ? <div className="admin-sidebar-backdrop" onClick={() => closeDrawer()} aria-hidden="true" /> : null}
      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        className="admin-sidebar"
        role={mobile && drawerOpen ? 'dialog' : undefined}
        aria-modal={mobile && drawerOpen ? true : undefined}
        aria-label={mobile && drawerOpen ? t('ui.nav.work') : undefined}
        aria-hidden={mobile && !drawerOpen}
        inert={mobile && !drawerOpen}
      >
        <div className="admin-sidebar-head">
          <Brand admin />
          <button
            ref={closeButtonRef}
            type="button"
            className="admin-sidebar-control admin-sidebar-close"
            onClick={() => closeDrawer()}
            aria-label={t('ui.nav.closeSidebar')}
            title={t('ui.nav.closeSidebar')}
          >
            <X size={19} />
          </button>
        </div>
        <nav aria-label={t('ui.nav.work')}>
          <NavLink end to="/admin" {...navLabel(t('ui.nav.dashboard'))}>
            <LayoutDashboard size={18} aria-hidden="true" />
            <span className="admin-nav-label">{t('ui.nav.dashboard')}</span>
          </NavLink>
          {modules.map(({ icon: Icon, permissionKey, route, title }) => {
            const label = permissionKey === 'restaurants' && !isPlatformAdmin ? t('ui.nav.restaurant') : permissionKey === 'audit-logs' && route === '/admin/outbox' ? t('ui.nav.outbox') : title
            return <NavLink key={route} to={route} className={({ isActive }) => isActive && !(route === '/admin/inventory' && location.pathname.startsWith('/admin/inventory/movements')) ? 'active' : undefined} {...navLabel(label)}><Icon size={18} aria-hidden="true" /><span className="admin-nav-label">{label}</span></NavLink>
          })}
          {isPlatformAdmin ? <NavLink to="/admin/localization" {...navLabel(t('ui.localization.title'))}><Languages size={18} aria-hidden="true" /><span className="admin-nav-label">{t('ui.localization.title')}</span></NavLink> : null}
        </nav>
        <button
          type="button"
          className="admin-sidebar-control admin-sidebar-collapse"
          onClick={toggleCollapsed}
          aria-label={t(collapsed ? 'ui.nav.expandSidebar' : 'ui.nav.collapseSidebar')}
          title={t(collapsed ? 'ui.nav.expandSidebar' : 'ui.nav.collapseSidebar')}
          aria-expanded={!collapsed}
          aria-controls="admin-sidebar"
        >
          {collapsed ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
        </button>
      </aside>
      <div className="admin-workspace" inert={mobile && drawerOpen} aria-hidden={mobile && drawerOpen}>
        <header className="admin-topbar compact">
          <button
            ref={menuButtonRef}
            type="button"
            className="admin-sidebar-control admin-sidebar-menu"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('ui.nav.openSidebar')}
            title={t('ui.nav.openSidebar')}
            aria-expanded={drawerOpen}
            aria-controls="admin-sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="site-actions">
            <LanguageSwitcher />
            <ThemeToggle />
            <WorkspaceSwitcher mode="workspace" />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <div className="route-transition">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
