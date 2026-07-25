import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

type RequireAuthProps = {
  children: ReactNode
  allowedRoleIds?: string[]
  anyPermission?: string[]
}

export function RequireAuth({ children, allowedRoleIds, anyPermission }: RequireAuthProps) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const hasAllowedRole = !allowedRoleIds?.length || allowedRoleIds.includes(user?.roleId ?? '')
  const hasPermission = !anyPermission?.length || anyPermission.some((permission) => user?.permissions.includes(permission))

  if (!hasAllowedRole || !hasPermission) {
    return <Navigate to="/" replace />
  }

  return children
}
