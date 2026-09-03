import type { AnyRecord } from '../api/responseUtils'
import { str } from '../api/responseUtils'

export type CurrentUser = {
  userId: string
  name: string
  surname: string
  email: string
  roleId: string
  roleName: string
  restaurantId?: string
  restaurantIds: string[]
  restaurantRoles: RestaurantRoleAssignment[]
  profiles: UserAccessProfile[]
  permissions: string[]
}

export type RestaurantRoleAssignment = {
  restaurantId: string
  roleId: string
}

export type UserAccessProfile = RestaurantRoleAssignment & {
  restaurantName?: string
  roleName?: string
  isActive?: boolean
}

const roleClaim = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'

function claimArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean)
  }

  const singleValue = str(value)
  return singleValue
    ? singleValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function parseRestaurantRoles(value: unknown): RestaurantRoleAssignment[] {
  return claimArray(value)
    .map((item) => {
      const [restaurantId, roleId] = item.split(':').map((part) => part.trim())
      return restaurantId && roleId ? { restaurantId, roleId } : null
    })
    .filter((item): item is RestaurantRoleAssignment => item !== null)
}

export function decodeJwtPayload(token: string): AnyRecord | null {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    )

    return JSON.parse(json) as AnyRecord
  } catch {
    return null
  }
}

export function getUserFromToken(token: string): CurrentUser | null {
  const payload = decodeJwtPayload(token)
  if (!payload) {
    return null
  }

  const restaurantId = str(payload.restaurantId) || undefined
  const restaurantRoles = parseRestaurantRoles(payload.restaurantRoles)
  const profiles = restaurantRoles.map((assignment) => ({ ...assignment }))
  const restaurantIds = unique([
    ...claimArray(payload.restaurantIds),
    ...restaurantRoles.map((assignment) => assignment.restaurantId),
    restaurantId || '',
  ])

  return {
    userId: str(payload.userId),
    name: str(payload.name),
    surname: str(payload.surname),
    email: str(payload.email),
    roleId: str(payload[roleClaim] || payload.roleId),
    roleName: str(payload.roleName),
    restaurantId,
    restaurantIds,
    restaurantRoles,
    profiles,
    permissions: claimArray(payload.permission || payload.permissions),
  }
}
