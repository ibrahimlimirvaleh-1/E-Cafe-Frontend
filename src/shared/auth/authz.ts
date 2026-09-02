import type { CurrentUser } from './jwt'

export const RoleIds = {
  PlatformAdmin: '1',
  Owner: '2',
  Manager: '3',
  Waiter: '4',
  Customer: '5',
  Kitchen: '6',
} as const

export const AdminRoleIds: readonly string[] = [RoleIds.PlatformAdmin, RoleIds.Owner, RoleIds.Manager]

export function getRestaurantRoleId(user: CurrentUser | null | undefined, restaurantId: string | null | undefined) {
  if (!user || !restaurantId) {
    return undefined
  }

  return user.restaurantRoles.find((assignment) => assignment.restaurantId === restaurantId)?.roleId
}

export function getRoleIds(user: CurrentUser | null | undefined, restaurantId?: string | null) {
  if (!user) {
    return []
  }

  const scopedRoleId = getRestaurantRoleId(user, restaurantId)
  const roleIds = restaurantId
    ? [scopedRoleId]
    : [user.roleId, ...user.restaurantRoles.map((assignment) => assignment.roleId)]

  return [...new Set(roleIds.filter((roleId): roleId is string => Boolean(roleId)))]
}

export function isInRole(user: CurrentUser | null | undefined, roleIds: readonly string[], restaurantId?: string | null) {
  return getRoleIds(user, restaurantId).some((roleId) => roleIds.includes(roleId))
}

export function isPlatformAdmin(user: CurrentUser | null | undefined) {
  return user?.roleId === RoleIds.PlatformAdmin
}

export function canAccessRestaurant(user: CurrentUser | null | undefined, restaurantId: string | null | undefined) {
  if (!restaurantId) {
    return false
  }

  return isPlatformAdmin(user) || user?.restaurantIds.includes(restaurantId) === true
}

export function getAccessibleItems<T extends { id: string }>(user: CurrentUser | null | undefined, items: T[]) {
  return items.filter((item) => canAccessRestaurant(user, item.id))
}

export function hasPermission(user: CurrentUser | null | undefined, permission: string) {
  return Boolean(user?.permissions.includes(permission))
}

export function hasAnyPermission(user: CurrentUser | null | undefined, permissions: readonly string[]) {
  return permissions.length === 0 || permissions.some((permission) => hasPermission(user, permission))
}

export function canAccess(user: CurrentUser | null | undefined, options: { roleIds?: readonly string[]; permissions?: readonly string[] }) {
  const hasAllowedRole = !options.roleIds?.length || isInRole(user, options.roleIds)
  const hasRequiredPermission = isPlatformAdmin(user) || !options.permissions?.length || hasAnyPermission(user, options.permissions)

  return hasAllowedRole && hasRequiredPermission
}

export function getHomePathForUser(user: CurrentUser | null | undefined) {
  if (isInRole(user, AdminRoleIds)) {
    return '/admin'
  }

  if (isInRole(user, [RoleIds.Waiter])) {
    return '/waiter'
  }

  if (isInRole(user, [RoleIds.Kitchen])) {
    return '/kitchen'
  }

  return '/'
}
