import type { AdminModuleKey } from '../../entities/types'
import type { CurrentUser } from '../auth/jwt'
import { RoleIds, hasAnyPermission, isInRole } from '../auth/authz'

export const adminModulePermissions: Record<AdminModuleKey, string[]> = {
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
  inventory: ['ViewInventory', 'ManageInventory'],
  'inventory-movements': ['ViewInventory', 'ManageInventory'],
  recipes: ['ViewRecipes', 'ManageRecipes'],
  'audit-logs': ['ViewAuditLogs'],
}

const adminModuleRoleAccess: Partial<Record<AdminModuleKey, readonly string[]>> = {
  restaurants: [RoleIds.PlatformAdmin, RoleIds.Owner],
  contracts: [RoleIds.PlatformAdmin, RoleIds.Owner],
  'restaurant-groups': [RoleIds.PlatformAdmin],
}

export function canAccessAdminModule(user: CurrentUser | null | undefined, moduleKey: AdminModuleKey) {
  const allowedRoles = adminModuleRoleAccess[moduleKey]
  if (allowedRoles?.length && !isInRole(user, allowedRoles)) {
    return false
  }

  return isInRole(user, [RoleIds.PlatformAdmin]) || hasAnyPermission(user, adminModulePermissions[moduleKey])
}
