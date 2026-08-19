import { NavLink, Outlet } from 'react-router-dom'
import { MailWarning } from 'lucide-react'
import { adminModules } from '../../entities/mockData'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, hasAnyPermission, isInRole } from '../auth/authz'
import { adminModulePermissions } from '../config/adminPermissions'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

const outboxAdminModule = {
  permissionKey: 'audit-logs',
  title: 'Sistem mesajları',
  route: '/admin/outbox',
  icon: MailWarning,
} as const

export function AdminShell() {
  const { user } = useAuth()
  const isSuperAdmin = isInRole(user, [RoleIds.PlatformAdmin])
  const configuredModules = [
    ...adminModules.map((module) => ({ ...module, permissionKey: module.key })),
    outboxAdminModule,
  ]
  const modules = isSuperAdmin
    ? configuredModules
    : configuredModules.filter((module) => hasAnyPermission(user, adminModulePermissions[module.permissionKey]))

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand admin />
        <nav aria-label="Admin naviqasiyası">
          <NavLink end to="/admin">
            Dashboard
          </NavLink>
          {modules.map(({ icon: Icon, route, title }) => (
            <NavLink key={route} to={route}>
              <Icon size={18} />
              {title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar compact">
          <div className="site-actions">
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
