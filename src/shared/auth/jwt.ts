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
  permissions: string[]
}

const roleClaim = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'

function claimArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean)
  }

  const singleValue = str(value)
  return singleValue ? [singleValue] : []
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

  return {
    userId: str(payload.userId),
    name: str(payload.name),
    surname: str(payload.surname),
    email: str(payload.email),
    roleId: str(payload[roleClaim]),
    roleName: str(payload.roleName),
    restaurantId: str(payload.restaurantId) || undefined,
    permissions: claimArray(payload.permission || payload.permissions),
  }
}
