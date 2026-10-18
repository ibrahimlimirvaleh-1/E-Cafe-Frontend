import { i18n } from '../i18n/i18n'
import { Bell, CheckCheck, FileText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { NotificationItem } from '../../entities/types'
import { ecafeApi } from '../api/ecafeApi'
import { useAuth } from '../auth/AuthContext'
import { getNotificationTarget } from '../notifications/notificationTarget'
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
  const { isAuthenticated, selectProfileForRestaurant, user } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)
  const hasLoadedRef = useRef(false)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const activeProfileKey = `${user?.userId || ''}:${user?.restaurantId || ''}:${user?.roleId || ''}`

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      hasLoadedRef.current = false
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(!hasLoadedRef.current)
    try {
      const [items, count] = await Promise.all([ecafeApi.notifications.list(), ecafeApi.notifications.unreadCount()])
      if (requestIdRef.current === requestId) {
        setNotifications(items)
        setUnreadCount(count)
        hasLoadedRef.current = true
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Notifications could not be refreshed.', error)
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [activeProfileKey, isAuthenticated])

  useEffect(() => {
    hasLoadedRef.current = false
    void loadNotifications()
  }, [activeProfileKey, loadNotifications])

  useEffect(() => {
    const onRefresh = () => {
      void loadNotifications()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      }
    }

    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('ecafe:notifications-refresh', onRefresh)
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

  const onNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await ecafeApi.notifications.markAsRead(notification.id)
      setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)))
      setUnreadCount((count) => Math.max(0, count - 1))
    }

    const target = getNotificationTarget(notification, user)
    setIsOpen(false)
    if (target) {
      const restaurantId = new URL(target, window.location.origin).searchParams.get('restaurantId')
      if (restaurantId) {
        selectProfileForRestaurant(restaurantId)
      }

      navigate(target)
    }
  }

  const onMarkAllAsRead = async () => {
    await ecafeApi.notifications.markAllAsRead()
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <div className="notification-menu" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-label={i18n.t('ui.shared.layout.notification_bell.bildirisler_1f9d3f')}
        className={`icon-action notification-trigger${unreadCount > 0 ? ' has-unread' : ''}`}
        onClick={onToggle}
        title={i18n.t('ui.shared.layout.notification_bell.bildirisler_1f9d3f')}
        type="button"
      >
        <Bell size={18} />
        {unreadCount > 0 ? <span>{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <div className="notification-popover">
          <header>
            <div>
              <strong>{i18n.t('ui.shared.layout.notification_bell.bildirisler_1f9d3f')}</strong>
              <small>{unreadCount > 0 ? `${unreadCount} oxunmamış` :i18n.t('ui.shared.layout.notification_bell.hamisi_oxunub_0d609a')}</small>
            </div>
            <button disabled={unreadCount === 0} onClick={onMarkAllAsRead} title={i18n.t('ui.shared.layout.notification_bell.hamisini_oxunmus_et_cacc2d')} type="button">
              <CheckCheck size={17} />
            </button>
          </header>

          <div className="notification-list">
            {isLoading ? <p>{i18n.t('ui.shared.layout.notification_bell.yuklenir_e038b0')}</p> : null}
            {!isLoading && notifications.length === 0 ? (
              <div className="notification-empty">
                <FileText size={20} />
                <span>{i18n.t('ui.shared.layout.notification_bell.bildiris_yoxdur_68216b')}</span>
              </div>
            ) : null}
            {!isLoading
              ? notifications.slice(0, 6).map((notification) => (
                  <button
                    className={notification.isRead ? '' : 'unread'}
                    key={notification.id}
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
