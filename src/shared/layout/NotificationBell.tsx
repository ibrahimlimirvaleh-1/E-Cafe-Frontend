import { Bell, CheckCheck, FileText } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { NotificationItem } from '../../entities/types'
import { ecafeApi } from '../api/ecafeApi'
import { useAuth } from '../auth/AuthContext'
import { getNotificationTarget } from '../notifications/notificationTarget'

function formatNotificationDate(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('az-AZ', {
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
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    setIsLoading(true)
    try {
      const [items, count] = await Promise.all([ecafeApi.notifications.list(), ecafeApi.notifications.unreadCount()])
      setNotifications(items)
      setUnreadCount(count)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const onRefresh = () => {
      void loadNotifications()
    }

    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', onRefresh)
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
    if (!isOpen) {
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
      const restaurantId = new URLSearchParams(target.split('?')[1] || '').get('restaurantId')
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
        aria-label="Bildirişlər"
        className={`icon-action notification-trigger${unreadCount > 0 ? ' has-unread' : ''}`}
        onClick={onToggle}
        title="Bildirişlər"
        type="button"
      >
        <Bell size={18} />
        {unreadCount > 0 ? <span>{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <div className="notification-popover">
          <header>
            <div>
              <strong>Bildirişlər</strong>
              <small>{unreadCount > 0 ? `${unreadCount} oxunmamış` : 'Hamısı oxunub'}</small>
            </div>
            <button disabled={unreadCount === 0} onClick={onMarkAllAsRead} title="Hamısını oxunmuş et" type="button">
              <CheckCheck size={17} />
            </button>
          </header>

          <div className="notification-list">
            {isLoading ? <p>Yüklənir...</p> : null}
            {!isLoading && notifications.length === 0 ? (
              <div className="notification-empty">
                <FileText size={20} />
                <span>Bildiriş yoxdur</span>
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

          <Link className="notification-all-link" onClick={() => setIsOpen(false)} to="/notifications">
            Hamısına bax
          </Link>
        </div>
      ) : null}
    </div>
  )
}
