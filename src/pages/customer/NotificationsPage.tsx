import { Bell, CheckCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NotificationItem, StatusTone } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

function parsePayload(payloadJson?: string) {
  if (!payloadJson) {
    return {} as Record<string, unknown>
  }

  try {
    return JSON.parse(payloadJson) as Record<string, unknown>
  } catch {
    return {}
  }
}

function valueAsString(value: unknown) {
  return value == null ? '' : String(value)
}

function notificationRoute(notification: NotificationItem, roleId?: string) {
  const payload = parsePayload(notification.payloadJson)
  const relatedType = `${notification.relatedEntityType || ''} ${notification.typeName || ''}`.toLowerCase()
  const contractId =
    valueAsString(payload.contractId || payload.ContractId) ||
    (relatedType.includes('contract') ? valueAsString(notification.relatedEntityId) : '')
  const restaurantId = valueAsString(payload.restaurantId || payload.RestaurantId || notification.restaurantId)

  if (contractId && ['1', '2', '3'].includes(roleId || '')) {
    return `/admin/contracts/${contractId}`
  }

  if (relatedType.includes('order')) {
    if (roleId === '6') {
      return '/kitchen'
    }

    if (roleId === '4') {
      return '/waiter/orders'
    }

    return '/admin/orders'
  }

  if (relatedType.includes('reservation')) {
    return '/admin/reservations'
  }

  if (restaurantId && ['1', '2', '3'].includes(roleId || '')) {
    return `/admin/restaurants/${restaurantId}`
  }

  return ''
}

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

    const route = notificationRoute(notification, user?.roleId)
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
