import { Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NotificationItem, StatusTone } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAuth } from '../../shared/auth/AuthContext'
import { isNotificationAccessDenied, useNotificationActions } from '../../shared/notifications/useNotificationActions'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import './notifications.css'

function tone(notification: NotificationItem): StatusTone {
  if (!notification.isRead) return 'warning'
  return notification.typeName.toLowerCase().includes('terminated') ? 'danger' : 'neutral'
}

export function NotificationsPage() {
  const { scopeRevision, user } = useAuth()
  return <ScopedNotificationsPage key={`${user?.userId}:${user?.restaurantId}:${user?.roleId}:${scopeRevision}`} />
}

function ScopedNotificationsPage() {
  const { t, i18n } = useTranslation()
  const { scopeRevision, user, isCurrentSession } = useAuth()
  const actions = useNotificationActions()
  const [reloadKey, setReloadKey] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const key = JSON.stringify([pageNumber, pageSize, i18n.resolvedLanguage])
  const keyRef = useRef(key); keyRef.current = key
  const requestRef = useRef<AbortController | null>(null)
  const [result, setResult] = useState<{ key: string; page: PaginatedResponse<NotificationItem>; unread: number } | null>(null)
  const [status, setStatus] = useState({ key, loading: true, error: '', denied: false })
  const hasData = result?.key === key
  const page = hasData ? result.page : null
  const denied = actions.accessDenied || (status.key === key && status.denied)
  const loading = status.key !== key || status.loading
  const error = status.key === key ? status.error || actions.error : ''

  useEffect(() => {
    const onRefresh = () => { requestRef.current?.abort(); setReloadKey(value => value + 1) }
    window.addEventListener('ecafe:notifications-refresh', onRefresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', onRefresh)
  }, [])

  useEffect(() => {
    if (!user || actions.accessDenied) return
    const controller = new AbortController(); requestRef.current = controller
    const current = () => !controller.signal.aborted && keyRef.current === key && isCurrentSession(user.userId, scopeRevision.split(':')[0], user.roleId, user.restaurantId)
    setStatus({ key, loading: true, error: '', denied: false })
    void Promise.all([ecafeApi.notifications.page({ pageNumber, pageSize }, controller.signal), ecafeApi.notifications.unreadCount(controller.signal)]).then(([data, unread]) => {
      if (!current()) return
      const lastPage = Math.max(1, data.totalPages)
      if (pageNumber > lastPage) { setPageNumber(lastPage); return }
      setResult({ key, page: data, unread })
    }).catch(error => {
      if (!current()) return
      const denied = isNotificationAccessDenied(error)
      if (denied) setResult(null)
      setStatus({ key, loading: false, denied, error: denied ? t('ui.tenantAccess.notificationsDenied') : normalizeCaughtApiError(error, t('ui.notifications.loadFailed')).message })
    }).finally(() => { if (current()) setStatus(state => ({ ...state, loading: false })) })
    return () => controller.abort()
  }, [key, reloadKey, actions.accessDenied, isCurrentSession, scopeRevision, user?.userId, user?.roleId, user?.restaurantId, t, pageNumber, pageSize])

  const refresh = () => window.dispatchEvent(new Event('ecafe:notifications-refresh'))
  function read(notification?: NotificationItem) {
    setResult(current => current?.key === key ? { ...current, unread: notification ? Math.max(0, current.unread - (notification.isRead ? 0 : 1)) : 0, page: { ...current.page, items: current.page.items.map(item => !notification || item.id === notification.id ? { ...item, isRead: true } : item) } } : current)
    refresh()
  }
  const notifications = denied ? [] : page?.items || []
  const unread = denied ? 0 : hasData ? result.unread : 0
  const date = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? '-' : formatReservationDateTime(value)
  }

  return <main className="page notifications-page">
    <PageHeader eyebrow={t('ui.pages.customer.notifications_page.hesab_18adfa')} title={t('ui.pages.customer.notifications_page.bildirisler_1f9d3f')}
      description={unread > 0 ? t('ui.notifications.unread', { count: unread }) : hasData ? t('ui.pages.customer.notifications_page.yeni_bildiris_yoxdur_5e0e46') : undefined}
      action={<div className="notification-page-actions">
        <Button variant="secondary" disabled={loading || denied} onClick={refresh} title={t('ui.notifications.refresh')} aria-label={t('ui.notifications.refresh')}><RefreshCw size={18} /></Button>
        <Button disabled={unread === 0 || actions.isUpdating || denied} onClick={() => void actions.markAllAsRead(() => read())} variant="secondary"><CheckCheck size={18} />{t('ui.pages.customer.notifications_page.hamisini_oxunmus_et_cacc2d')}</Button>
      </div>} />
    {error || actions.accessDenied ? <div className="notification-page-feedback"><StatusMessage tone="danger" autoHideMs={false}>{actions.accessDenied ? t('ui.tenantAccess.notificationsDenied') : error}</StatusMessage>{!denied ? <Button variant="secondary" onClick={refresh} disabled={loading}><RefreshCw size={16} />{t('ui.notifications.retry')}</Button> : null}</div> : null}
    {loading && !hasData && !denied ? <p role="status">{t('ui.pages.customer.notifications_page.bildirisler_yuklenir_57fb44')}</p> : null}
    {!loading && !error && !denied && notifications.length === 0 ? <div className="placeholder-panel"><Bell size={28} /><h2>{t('ui.pages.customer.notifications_page.bildiris_yoxdur_68216b')}</h2></div> : null}
    <section className="notification-page-list" aria-busy={loading || actions.isUpdating}>
      {notifications.map(notification => <button key={notification.id} disabled={actions.isUpdating} onClick={() => void actions.openNotification(notification, () => read(notification))} type="button">
        <span><strong>{notification.title || notification.typeName}</strong><small>{notification.message}</small></span>
        <span className="notification-page-meta"><Badge tone={tone(notification)}>{t(notification.isRead ? 'ui.pages.customer.notifications_page.oxunub_9285c6' : 'ui.pages.customer.notifications_page.yeni_e17ccb')}</Badge><time dateTime={notification.createdAt}>{date(notification.createdAt)}</time></span>
      </button>)}
    </section>
    {page && !denied ? <PaginationControls ariaLabel={t('ui.notifications.pagination')} hasNextPage={page.hasNextPage} hasPreviousPage={page.hasPreviousPage} pageIndex={page.pageIndex} pageSize={pageSize} pageSizeOptions={[10, 20, 50, 100]} showOnSinglePage totalCount={page.totalCount} totalPages={page.totalPages} onPageChange={setPageNumber} onPageSizeChange={size => { setPageSize(size); setPageNumber(1) }} /> : null}
  </main>
}
