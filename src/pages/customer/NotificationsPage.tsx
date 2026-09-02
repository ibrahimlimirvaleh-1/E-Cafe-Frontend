import { Bell, CheckCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NotificationItem, StatusTone } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { getNotificationTarget } from '../../shared/notifications/notificationTarget'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

function formatDate(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('az-AZ', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'long',
        year: 'numeric',
      })
}

function tone(notification: NotificationItem): StatusTone {
  if (!notification.isRead) {
    return 'warning'
  }

  if (notification.typeName.toLowerCase().includes('terminated')) {
    return 'danger'
  }

  return 'neutral'
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: notifications, isLoading } = useAsyncData(() => ecafeApi.notifications.list(), [], [reloadKey])
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.isRead).length, [notifications])

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await ecafeApi.notifications.markAsRead(notification.id)
    }

    const route = getNotificationTarget(notification, user)
    setReloadKey((value) => value + 1)
    if (route) {
      navigate(route)
    }
  }

  const markAllAsRead = async () => {
    await ecafeApi.notifications.markAllAsRead()
    setReloadKey((value) => value + 1)
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Hesab"
        title="Bildirişlər"
        description={unreadCount > 0 ? `${unreadCount} oxunmamış bildiriş var` : 'Yeni bildiriş yoxdur'}
        action={
          <Button disabled={unreadCount === 0} onClick={markAllAsRead} variant="secondary">
            <CheckCheck size={18} />
            Hamısını oxunmuş et
          </Button>
        }
      />

      <section className="notification-page-list">
        {isLoading ? <p className="online-only">Bildirişlər yüklənir...</p> : null}
        {!isLoading && notifications.length === 0 ? (
          <div className="placeholder-panel">
            <Bell size={28} />
            <h2>Bildiriş yoxdur</h2>
          </div>
        ) : null}
        {!isLoading
          ? notifications.map((notification) => (
              <button key={notification.id} onClick={() => void openNotification(notification)} type="button">
                <span>
                  <strong>{notification.title || notification.typeName}</strong>
                  <small>{notification.message}</small>
                </span>
                <span className="notification-page-meta">
                  <Badge tone={tone(notification)}>{notification.isRead ? 'Oxunub' : 'Yeni'}</Badge>
                  <time>{formatDate(notification.createdAt)}</time>
                </span>
              </button>
            ))
          : null}
      </section>
    </main>
  )
}
