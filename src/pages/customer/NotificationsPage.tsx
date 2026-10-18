import { i18n } from '../../shared/i18n/i18n'
import { Bell, CheckCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NotificationItem, StatusTone } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { getNotificationTarget } from '../../shared/notifications/notificationTarget'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { getCurrentLanguage } from '../../shared/i18n/i18n'
import { getIntlLocale } from '../../shared/i18n/language'

function formatDate(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(getIntlLocale(getCurrentLanguage()), {
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
  const { selectProfileForRestaurant, user } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const onRefresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', onRefresh)
  }, [])
  const activeProfileKey = `${user?.userId || ''}:${user?.restaurantId || ''}:${user?.roleId || ''}`
  const { data: notifications, isLoading } = useKeyedAsyncData(() => ecafeApi.notifications.list(), [], activeProfileKey, [activeProfileKey, reloadKey])
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.isRead).length, [notifications])

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await ecafeApi.notifications.markAsRead(notification.id)
    }

    const route = getNotificationTarget(notification, user)
    setReloadKey((value) => value + 1)
    if (route) {
      const restaurantId = new URL(route, window.location.origin).searchParams.get('restaurantId')
      if (restaurantId) {
        selectProfileForRestaurant(restaurantId)
      }

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
        eyebrow={i18n.t('ui.pages.customer.notifications_page.hesab_18adfa')}
        title={i18n.t('ui.pages.customer.notifications_page.bildirisler_1f9d3f')}
        description={unreadCount > 0 ? `${unreadCount} oxunmamış bildiriş var` :i18n.t('ui.pages.customer.notifications_page.yeni_bildiris_yoxdur_5e0e46')}
        action={
          <Button disabled={unreadCount === 0} onClick={markAllAsRead} variant="secondary">
            <CheckCheck size={18} />
            {i18n.t('ui.pages.customer.notifications_page.hamisini_oxunmus_et_cacc2d')}
          </Button>
        }
      />

      <section className="notification-page-list">
        {isLoading ? <p className="online-only">{i18n.t('ui.pages.customer.notifications_page.bildirisler_yuklenir_57fb44')}</p> : null}
        {!isLoading && notifications.length === 0 ? (
          <div className="placeholder-panel">
            <Bell size={28} />
            <h2>{i18n.t('ui.pages.customer.notifications_page.bildiris_yoxdur_68216b')}</h2>
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
                  <Badge tone={tone(notification)}>{notification.isRead ?i18n.t('ui.pages.customer.notifications_page.oxunub_9285c6') :i18n.t('ui.pages.customer.notifications_page.yeni_e17ccb')}</Badge>
                  <time>{formatDate(notification.createdAt)}</time>
                </span>
              </button>
            ))
          : null}
      </section>
    </main>
  )
}
