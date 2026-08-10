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

export function isInRole(user: CurrentUser | null | undefined, roleIds: readonly string[]) {
  return Boolean(user?.roleId && roleIds.includes(user.roleId))
}

export function hasPermission(user: CurrentUser | null | undefined, permission: string) {
  return Boolean(user?.permissions.includes(permission))
}

export function hasAnyPermission(user: CurrentUser | null | undefined, permissions: readonly string[]) {
  return permissions.length === 0 || permissions.some((permission) => hasPermission(user, permission))
}

export function canAccess(user: CurrentUser | null | undefined, options: { roleIds?: readonly string[]; permissions?: readonly string[] }) {
  const hasAllowedRole = !options.roleIds?.length || isInRole(user, options.roleIds)
  const hasRequiredPermission = isInRole(user, [RoleIds.PlatformAdmin]) || !options.permissions?.length || hasAnyPermission(user, options.permissions)

  return hasAllowedRole && hasRequiredPermission
}

export function getHomePathForUser(user: CurrentUser | null | undefined) {
  if (isInRole(user, [RoleIds.Waiter])) {
    return '/waiter'
  }

  if (isInRole(user, [RoleIds.Kitchen])) {
    return '/kitchen'
  }

  if (isInRole(user, AdminRoleIds)) {
    return '/admin'
  }

  return '/'
}
