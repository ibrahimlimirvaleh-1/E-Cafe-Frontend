import { NavLink, Outlet } from 'react-router-dom'
import { Languages, MailWarning } from 'lucide-react'
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

export function AdminShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const configuredModules = [
    ...adminModules.map((module) => ({ ...localizeAdminModule(module), permissionKey: module.key })),
    outboxAdminModule,
  ]
  const modules = configuredModules.filter((module) => canAccessAdminModule(user, module.permissionKey))
  const isPlatformAdmin = isInRole(user, [RoleIds.PlatformAdmin])

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand admin />
        <nav aria-label={t('ui.nav.work')}>
          <NavLink end to="/admin">
            {t('ui.nav.dashboard')}
          </NavLink>
          {modules.map(({ icon: Icon, permissionKey, route, title }) => (
            <NavLink key={route} to={route}>
              <Icon size={18} />
              {permissionKey === 'restaurants' && !isPlatformAdmin ? t('ui.nav.restaurant') : permissionKey === 'audit-logs' && route === '/admin/outbox' ? t('ui.nav.outbox') : title}
            </NavLink>
          ))}
          {isPlatformAdmin ? <NavLink to="/admin/localization"><Languages size={18} />{t('ui.localization.title')}</NavLink> : null}
        </nav>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar compact">
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
