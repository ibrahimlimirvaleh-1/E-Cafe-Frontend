import { i18n } from '../../shared/i18n/i18n'
import { Bell, CheckCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { NotificationItem, StatusTone } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { isNotificationAccessDenied, useNotificationActions } from '../../shared/notifications/useNotificationActions'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
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
  const { scopeRevision, user } = useAuth()
  const actions = useNotificationActions()
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const onRefresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', onRefresh)
  }, [])
  const activeProfileKey = `${user?.userId || ''}:${user?.restaurantId || ''}:${user?.roleId || ''}:${scopeRevision}`
  const { data: feed, error: loadError, isLoading } = useKeyedAsyncData(async () => {
    try {
      return { items: await ecafeApi.notifications.list(), denied: false }
    } catch (error) {
      if (isNotificationAccessDenied(error)) return { items: [], denied: true }
      throw error
    }
  }, { items: [] as NotificationItem[], denied: false }, activeProfileKey, [activeProfileKey, reloadKey])
  const notifications = actions.accessDenied ? [] : feed.items
  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.isRead).length, [notifications])

  const refresh = () => { setReloadKey((value) => value + 1); window.dispatchEvent(new Event('ecafe:notifications-refresh')) }
  const error = feed.denied ? i18n.t('ui.tenantAccess.notificationsDenied') : actions.error || loadError

  return (
    <main className="page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.customer.notifications_page.hesab_18adfa')}
        title={i18n.t('ui.pages.customer.notifications_page.bildirisler_1f9d3f')}
        description={unreadCount > 0 ? `${unreadCount} oxunmamış bildiriş var` :i18n.t('ui.pages.customer.notifications_page.yeni_bildiris_yoxdur_5e0e46')}
        action={
          <Button disabled={unreadCount === 0 || actions.isUpdating || feed.denied || actions.accessDenied} onClick={() => void actions.markAllAsRead(refresh)} variant="secondary">
            <CheckCheck size={18} />
            {i18n.t('ui.pages.customer.notifications_page.hamisini_oxunmus_et_cacc2d')}
          </Button>
        }
      />

      <section className="notification-page-list">
        {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
        {isLoading ? <p className="online-only">{i18n.t('ui.pages.customer.notifications_page.bildirisler_yuklenir_57fb44')}</p> : null}
        {!isLoading && !error && notifications.length === 0 ? (
          <div className="placeholder-panel">
            <Bell size={28} />
            <h2>{i18n.t('ui.pages.customer.notifications_page.bildiris_yoxdur_68216b')}</h2>
          </div>
        ) : null}
        {!isLoading
          ? notifications.map((notification) => (
              <button key={notification.id} disabled={actions.isUpdating} onClick={() => void actions.openNotification(notification, refresh)} type="button">
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
