import { Search } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { adminModules } from '../../entities/mockData'
import type { AdminModuleKey } from '../../entities/types'
import { useAuth } from '../auth/AuthContext'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

const modulePermissions: Record<AdminModuleKey, string[]> = {
  restaurants: ['ManageRestaurants', 'ViewRestaurantInfo'],
  'restaurant-groups': ['ManageRestaurants'],
  contracts: ['ManageRestaurantContracts', 'ViewRestaurantContracts'],
  reservations: ['ManageReservations', 'ViewAssignedReservations'],
  orders: ['ManageOrders'],
  payments: ['ManagePayments'],
  staff: ['ManageStaff'],
  tables: ['ManageTables'],
  categories: ['ManageCatalog'],
  menu: ['ManageCatalog'],
  'audit-logs': ['ViewAuditLogs'],
}

export function AdminShell() {
  const { user } = useAuth()
  const isSuperAdmin = user?.roleId === '1'
  const modules = isSuperAdmin
    ? adminModules
    : adminModules.filter((module) => modulePermissions[module.key].some((permission) => user?.permissions.includes(permission)))

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
          <label className="admin-search">
            <Search size={18} />
            <input placeholder="Admin daxilində axtar..." />
          </label>
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
