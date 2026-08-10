import { NavLink, Outlet } from 'react-router-dom'
import { adminModules } from '../../entities/mockData'
import { useAuth } from '../auth/AuthContext'
import { RoleIds, hasAnyPermission, isInRole } from '../auth/authz'
import { adminModulePermissions } from '../config/adminPermissions'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

export function AdminShell() {
  const { user } = useAuth()
  const isSuperAdmin = isInRole(user, [RoleIds.PlatformAdmin])
  const modules = isSuperAdmin
    ? adminModules
    : adminModules.filter((module) => hasAnyPermission(user, adminModulePermissions[module.key]))

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
        <Outlet />
      </div>
    </div>
  )
}
