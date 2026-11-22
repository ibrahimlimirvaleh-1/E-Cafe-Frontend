import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NotificationItem } from '../../entities/types'
import { ecafeApi } from '../api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../api/httpClient'
import { useAuth } from '../auth/AuthContext'
import { i18n } from '../i18n/i18n'
import { getNotificationTarget } from './notificationTarget'

export function isNotificationAccessDenied(error: unknown) {
  return error instanceof ApiError && [401, 403].includes(error.statusCode)
}

export function useNotificationActions() {
  const { scopeRevision, selectProfileForRestaurant, user } = useAuth()
  const navigate = useNavigate()
  const scopeKey = `${user?.userId}:${user?.restaurantId}:${user?.roleId}:${scopeRevision}`
  const scopeRef = useRef({ key: scopeKey, generation: 0 })
  if (scopeRef.current.key !== scopeKey) scopeRef.current = { key: scopeKey, generation: scopeRef.current.generation + 1 }
  const scope = scopeRef.current
  const mountedRef = useRef(true)
  const pendingRef = useRef<{ scope: typeof scope } | null>(null)
  const controllersRef = useRef(new Map<AbortController, typeof scope>())
  const [pending, setPending] = useState<{ scope: typeof scope } | null>(null)
  const [feedback, setFeedback] = useState({ scope, message: '', denied: false })
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => () => {
    for (const [controller, owner] of controllersRef.current) if (owner === scope) controller.abort()
  }, [scope])

  async function run(operation: (signal: AbortSignal) => Promise<unknown>, onSuccess: () => void) {
    if (pendingRef.current?.scope === scope || !user) return
    const isCurrent = () => mountedRef.current && scopeRef.current === scope
    if (!isCurrent()) return
    const operationToken = { scope }
    const controller = new AbortController()
    controllersRef.current.set(controller, scope)
    pendingRef.current = operationToken
    setPending(operationToken)
    setFeedback({ scope, message: '', denied: false })
    try {
      await operation(controller.signal)
      // A completed read belongs to the initiating session/profile, including navigation.
      if (isCurrent()) onSuccess()
    } catch (error) {
      if (isCurrent()) {
        const denied = isNotificationAccessDenied(error)
        setFeedback({ scope, denied, message: denied ? i18n.t('ui.tenantAccess.notificationsDenied') : normalizeCaughtApiError(error, i18n.t('ui.tenantAccess.notificationsFailed')).message })
      }
    } finally {
      controllersRef.current.delete(controller)
      if (pendingRef.current === operationToken) {
        pendingRef.current = null
        if (isCurrent()) setPending(null)
      }
    }
  }

  return {
    isUpdating: pending?.scope === scope,
    error: feedback.scope === scope ? feedback.message : '',
    accessDenied: feedback.scope === scope && feedback.denied,
    openNotification: (notification: NotificationItem, onRead: () => void) => run(
      signal => notification.isRead ? Promise.resolve() : ecafeApi.notifications.markAsRead(notification.id, signal),
      () => {
        onRead()
        const target = getNotificationTarget(notification, user)
        if (!target) return
        const restaurantId = new URL(target, window.location.origin).searchParams.get('restaurantId')
        if (restaurantId) selectProfileForRestaurant(restaurantId)
        navigate(target)
      },
    ),
    markAllAsRead: (onRead: () => void) => run(signal => ecafeApi.notifications.markAllAsRead(signal), onRead),
  }
}
