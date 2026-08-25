import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canAccess, getHomePathForUser } from './authz'

type RequireAuthProps = {
  children: ReactNode
  allowedRoleIds?: readonly string[]
  anyPermission?: readonly string[]
}

export function RequireAuth({ children, allowedRoleIds, anyPermission }: RequireAuthProps) {
  const { isAuthenticated, isAuthReady, user } = useAuth()
  const location = useLocation()

  if (!isAuthReady) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!canAccess(user, { roleIds: allowedRoleIds, permissions: anyPermission })) {
    return <Navigate to={getHomePathForUser(user)} replace />
  }

  return children
}
