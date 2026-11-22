import { i18n } from '../i18n/i18n'
import { Bell, CheckCheck, FileText, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { NotificationItem } from '../../entities/types'
import { ecafeApi } from '../api/ecafeApi'
import { ApiError } from '../api/httpClient'
import { useAuth } from '../auth/AuthContext'
import { useNotificationActions } from '../notifications/useNotificationActions'
import { StatusMessage } from '../ui/StatusMessage'
import { getIntlLocale } from '../i18n/language'
import { getCurrentLanguage } from '../i18n/i18n'

function formatNotificationDate(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(getIntlLocale(getCurrentLanguage()), {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
      })
}

export function NotificationBell() {
  const { scopeRevision, user } = useAuth()
  return <ScopedNotificationBell key={`${user?.userId}:${user?.restaurantId}:${user?.roleId}:${scopeRevision}`} />
}

function ScopedNotificationBell() {
  const { isAuthenticated, realtimeStatus, user } = useAuth()
  const actions = useNotificationActions()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)
  const hasLoadedRef = useRef(false)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const retryCountRef = useRef(0)
  const authBlockedRef = useRef(false)
  const refreshTimerRef = useRef<number | undefined>(undefined)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const activeProfileKey = `${user?.userId || ''}:${user?.restaurantId || ''}:${user?.roleId || ''}`
  const connectionDescription = realtimeStatus === 'connected' ? '' : i18n.t(
    realtimeStatus === 'reconnecting' || realtimeStatus === 'connecting' ? 'ui.realtime.reconnecting' : 'ui.realtime.offline')

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      hasLoadedRef.current = false
      return
    }
    if (authBlockedRef.current || document.hidden) return

    if (inFlightRef.current) {
      pendingRef.current = true
      return
    }

    window.clearTimeout(refreshTimerRef.current)
    inFlightRef.current = true

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    let succeeded = false
    let canRetry = true
    setIsLoading(!hasLoadedRef.current)
    setLoadError('')
    try {
      const [items, count] = await Promise.all([ecafeApi.notifications.list(), ecafeApi.notifications.unreadCount()])
      if (requestIdRef.current === requestId) {
        setNotifications(items)
        setUnreadCount(count)
        hasLoadedRef.current = true
        retryCountRef.current = 0
        succeeded = true
      }
    } catch (error) {
      if (requestIdRef.current === requestId && error instanceof ApiError && [401, 403].includes(error.statusCode)) {
        authBlockedRef.current = true
        canRetry = false
        setNotifications([])
        setUnreadCount(0)
        setLoadError(i18n.t('ui.tenantAccess.notificationsDenied'))
      }
      if (import.meta.env.DEV) {
        console.error('Notifications could not be refreshed.', error)
      }
    } finally {
      if (requestIdRef.current === requestId) {
        inFlightRef.current = false
        setIsLoading(false)
        const pending = pendingRef.current
        pendingRef.current = false
        const retryDelay = Math.min(30000, 3000 * 2 ** Math.min(retryCountRef.current, 4))
        if (!succeeded) retryCountRef.current += 1
        if (canRetry && !document.hidden) refreshTimerRef.current = window.setTimeout(() => void loadNotifications(), pending ? 200 : succeeded ? 45000 : retryDelay)
      }
    }
  }, [activeProfileKey, isAuthenticated])

  useEffect(() => {
    requestIdRef.current += 1
    hasLoadedRef.current = false
    inFlightRef.current = false
    pendingRef.current = false
    retryCountRef.current = 0
    authBlockedRef.current = false
    setNotifications([])
    setUnreadCount(0)
    void loadNotifications()
    return () => {
      requestIdRef.current += 1
      window.clearTimeout(refreshTimerRef.current)
      inFlightRef.current = false
      pendingRef.current = false
    }
  }, [activeProfileKey, loadNotifications])

  useEffect(() => {
    const onRefresh = () => {
      if (authBlockedRef.current || document.hidden) return
      if (inFlightRef.current) {
        pendingRef.current = true
        return
      }
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(() => void loadNotifications(), 200)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      } else {
        window.clearTimeout(refreshTimerRef.current)
      }
    }

    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    window.addEventListener('online', onRefresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('ecafe:notifications-refresh', onRefresh)
      window.removeEventListener('online', onRefresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadNotifications])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  if (!isAuthenticated) {
    return null
  }

  const onToggle = () => {
    setIsOpen((current) => !current)
    if (!isOpen && !hasLoadedRef.current) {
      void loadNotifications()
    }
  }

  const onNotificationClick = (notification: NotificationItem) => actions.openNotification(notification, () => {
    if (!notification.isRead) {
      setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)))
      setUnreadCount((count) => Math.max(0, count - 1))
    }
    setIsOpen(false)
  })

  const onMarkAllAsRead = () => actions.markAllAsRead(() => {
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
  })
  const visibleNotifications = actions.accessDenied ? [] : notifications

  return (
    <div className="notification-menu" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-label={i18n.t('ui.shared.layout.notification_bell.bildirisler_1f9d3f')}
        className={`icon-action notification-trigger${unreadCount > 0 ? ' has-unread' : ''}`}
        onClick={onToggle}
        title={`${i18n.t('ui.shared.layout.notification_bell.bildirisler_1f9d3f')}${connectionDescription ? ` · ${connectionDescription}` : ''}`}
        type="button"
      >
        <Bell size={18} />
        {!actions.accessDenied && unreadCount > 0 ? <span>{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      {connectionDescription ? <span className="realtime-indicator" role="status" aria-label={connectionDescription}><WifiOff size={12} /></span> : null}

      {isOpen ? (
        <div className="notification-popover">
          {connectionDescription ? <p className="notification-connection-note" role="status"><WifiOff size={15} />{connectionDescription}</p> : null}
          <header>
            <div>
              <strong>{i18n.t('ui.shared.layout.notification_bell.bildirisler_1f9d3f')}</strong>
              <small>{!actions.accessDenied && unreadCount > 0 ? `${unreadCount} oxunmamış` :i18n.t('ui.shared.layout.notification_bell.hamisi_oxunub_0d609a')}</small>
            </div>
            <button disabled={unreadCount === 0 || actions.isUpdating || actions.accessDenied || Boolean(loadError)} onClick={() => void onMarkAllAsRead()} title={i18n.t('ui.shared.layout.notification_bell.hamisini_oxunmus_et_cacc2d')} type="button">
              <CheckCheck size={17} />
            </button>
          </header>

          <div className="notification-list">
            {loadError || actions.error ? <StatusMessage tone="danger" autoHideMs={false}>{loadError || actions.error}</StatusMessage> : null}
            {isLoading ? <p>{i18n.t('ui.shared.layout.notification_bell.yuklenir_e038b0')}</p> : null}
            {!isLoading && !loadError && !actions.error && visibleNotifications.length === 0 ? (
              <div className="notification-empty">
                <FileText size={20} />
                <span>{i18n.t('ui.shared.layout.notification_bell.bildiris_yoxdur_68216b')}</span>
              </div>
            ) : null}
            {!isLoading
              ? visibleNotifications.slice(0, 6).map((notification) => (
                  <button
                    className={notification.isRead ? '' : 'unread'}
                    key={notification.id}
                    disabled={actions.isUpdating}
                    onClick={() => void onNotificationClick(notification)}
                    type="button"
                  >
                    <span>
                      <strong>{notification.title || notification.typeName}</strong>
                      <small>{notification.message}</small>
                    </span>
                    <time>{formatNotificationDate(notification.createdAt)}</time>
                  </button>
                ))
              : null}
          </div>

          <Link className="notification-all-link" onClick={() => setIsOpen(false)} to="/notifications">{i18n.t('ui.shared.layout.notification_bell.hamisina_bax_8b6594')}</Link>
        </div>
      ) : null}
    </div>
  )
}
