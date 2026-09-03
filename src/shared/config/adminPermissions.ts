import type { AdminModuleKey } from '../../entities/types'
import type { CurrentUser } from '../auth/jwt'
import { RoleIds, canAccessRestaurant, getRestaurantRoleId, hasAnyPermission, hasAnyPermissionForRole, isInRole, isPlatformAdmin } from '../auth/authz'

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

export function canAccessAdminModule(user: CurrentUser | null | undefined, moduleKey: AdminModuleKey, restaurantId?: string | null) {
  if (restaurantId && !canAccessRestaurant(user, restaurantId)) {
    return false
  }

  if (isPlatformAdmin(user)) {
    return true
  }

  const scopedRoleId = restaurantId ? getRestaurantRoleId(user, restaurantId) : undefined
  const allowedRoles = adminModuleRoleAccess[moduleKey]
  if (allowedRoles?.length && !(scopedRoleId ? allowedRoles.includes(scopedRoleId) : isInRole(user, allowedRoles))) {
    return false
  }

  return scopedRoleId
    ? hasAnyPermissionForRole(scopedRoleId, adminModulePermissions[moduleKey])
    : hasAnyPermission(user, adminModulePermissions[moduleKey])
}
