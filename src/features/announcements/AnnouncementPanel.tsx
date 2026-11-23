import { ArrowRight, Check, ChevronRight, LoaderCircle, Megaphone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/auth/AuthContext'
import { getActiveProfileContext } from '../../shared/auth/activeProfileStorage'
import { announcementApi, announcementTarget, type PendingAnnouncements } from './announcementApi'
import './announcements.css'

type Owner = { key: string; active: boolean; attempted: boolean; settled: boolean; check: AbortController | null; ack: AbortController | null }
function sensitiveRoute(path: string) {
  return /^\/(login|register|confirm-email-change|set-password|reset-password|confirmation|account)(\/|$)/i.test(path)
    || /\/(reserve|tables|menu|new|edit)(\/|$)/i.test(path) || path.startsWith('/admin/announcements')
}
function obstructed() {
  return document.hidden || Boolean(document.querySelector('dialog[open], [aria-modal="true"], .modal-backdrop, .user-profile-menu, .notification-popover, .admin-sidebar-backdrop, form[aria-busy="true"], form:focus-within'))
}

export function AnnouncementPanel() {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated, isAuthReady, isProfileVerified, isCurrentSession, scopeRevision } = useAuth()
  const location = useLocation(), navigate = useNavigate()
  const active = getActiveProfileContext()
  const roleId = Number(active?.roleId || user?.roleId || 0)
  const restaurantId = active?.restaurantId ? Number(active.restaurantId) : null
  const epoch = `${user?.userId}:${scopeRevision.split(':')[0]}`
  const key = `${epoch}:${scopeRevision}:${roleId}:${restaurantId}:${i18n.resolvedLanguage}`
  const ownerRef = useRef<Owner>({ key, active: true, attempted: false, settled: false, check: null, ack: null })
  if (ownerRef.current.key !== key) ownerRef.current = { key, active: true, attempted: false, settled: false, check: null, ack: null }
  const owner = ownerRef.current
  const quietEpochs = useRef(new Set<string>())
  const seen = useRef(new Set<string>())
  const routeIdentity = `${location.key}:${location.pathname}:${location.search}:${location.hash}`
  const routeRef = useRef(routeIdentity); routeRef.current = routeIdentity
  const [batch, setBatch] = useState<{ owner: Owner; feed: PendingAnnouncements } | null>(null)
  const [busyOwner, setBusyOwner] = useState<Owner | null>(null)
  const busy = busyOwner === owner
  const [dirtyRoute, setDirtyRoute] = useState(false)
  const [blocked, setBlocked] = useState(true)
  const [, repaint] = useState(0)
  const ready = isAuthenticated && isAuthReady && isProfileVerified
  const seenKey = (id: number, version: number) => `${epoch}:${roleId}:${id}:${version}`
  const matchesScope = () => {
    const live = getActiveProfileContext()
    return Boolean(user && isCurrentSession(user.userId, scopeRevision.split(':')[0], user.roleId, user.restaurantId)
      && Number(live?.roleId || user.roleId) === roleId && (live?.restaurantId ? Number(live.restaurantId) : null) === restaurantId)
  }
  const isCurrent = (controller: AbortController) => ownerRef.current === owner && owner.active && !controller.signal.aborted && matchesScope()
  const quiet = () => { quietEpochs.current.add(epoch); setBatch(null); repaint(x => x + 1) }

  useEffect(() => {
    owner.active = true
    if (ready && !owner.attempted && !quietEpochs.current.has(epoch) && matchesScope()) {
      owner.attempted = true
      const controller = new AbortController(); owner.check = controller
      void announcementApi.pending(controller.signal).then(feed => {
        if (!isCurrent(controller)) return
        owner.settled = true
        if (feed.roleId !== roleId || feed.restaurantId !== restaurantId) { quiet(); return }
        setBatch({ owner, feed: { ...feed, items: feed.items.filter(item => !seen.current.has(seenKey(item.id, item.version))) } })
      }).catch(() => { if (isCurrent(controller)) quiet() })
    }
    return () => { owner.active = false; owner.check?.abort(); owner.ack?.abort(); if (!owner.settled) owner.attempted = false }
    // Receipt/get owners are deliberately distinct even for A-B-A context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, ready])

  useEffect(() => {
    setDirtyRoute(false)
    if (owner.ack) { owner.ack.abort(); owner.ack = null; setBusyOwner(null); quiet() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeIdentity, owner])

  useEffect(() => {
    const check = () => setBlocked(obstructed())
    const edit = (event: Event) => { if (event.target instanceof HTMLElement && event.target.closest('form')) setDirtyRoute(true); check() }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'aria-modal', 'aria-busy', 'class'] })
    document.addEventListener('visibilitychange', check)
    document.addEventListener('focusin', check); document.addEventListener('focusout', check)
    document.addEventListener('input', edit); document.addEventListener('change', edit)
    check()
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', check); document.removeEventListener('focusin', check); document.removeEventListener('focusout', check); document.removeEventListener('input', edit); document.removeEventListener('change', edit) }
  }, [])

  const feed = batch?.owner === owner ? batch.feed : null
  const item = feed?.items[0]
  const visible = Boolean(ready && item && !blocked && !dirtyRoute && !sensitiveRoute(location.pathname) && !quietEpochs.current.has(epoch))
  async function acknowledge(action: 'close' | 'next' | 'open') {
    if (!visible || !item || owner.ack || obstructed() || sensitiveRoute(location.pathname) || ownerRef.current !== owner || !matchesScope()) return
    const controller = new AbortController(); owner.ack = controller
    seen.current.add(seenKey(item.id, item.version))
    const route = routeRef.current
    const browserRoute = window.location.pathname + window.location.search + window.location.hash
    setBusyOwner(owner)
    try {
      await announcementApi.acknowledge(item.id, item.version, controller.signal)
      if (!isCurrent(controller)) return
      if (route !== routeRef.current || browserRoute !== window.location.pathname + window.location.search + window.location.hash) { quiet(); return }
      seen.current.add(seenKey(item.id, item.version))
      if (obstructed()) { quiet(); return }
      owner.ack = null
      setBatch(action === 'next' && feed ? { owner, feed: { ...feed, items: feed.items.slice(1) } } : null)
      if (action === 'open') {
        const target = announcementTarget(item.destination, roleId, restaurantId)
        if (target) navigate(target)
      }
    } catch { if (isCurrent(controller)) quiet() }
    finally { if (isCurrent(controller)) { owner.ack = null; setBusyOwner(null) } }
  }

  if (!visible || !item) return null
  return createPortal(<section className="announcement-panel" role="region" aria-label={t('ui.announcements.whatsNew')} aria-live="polite" data-announcement-id={item.id}>
    <header><span><Megaphone size={18} aria-hidden="true" />{t('ui.announcements.whatsNew')}</span><button type="button" disabled={busy} title={t('ui.announcements.dismiss')} aria-label={t('ui.announcements.dismiss')} onClick={() => void acknowledge('close')}><X size={18} /></button></header>
    <h2>{item.title}</h2><p>{item.body}</p>
    <footer><button type="button" className="announcement-open" disabled={busy} onClick={() => void acknowledge('open')}>{t('ui.announcements.open')}<ArrowRight size={16} /></button>
      <button type="button" disabled={busy} onClick={() => void acknowledge('next')}>{busy ? <LoaderCircle className="announcement-spinner" size={16} /> : feed && feed.items.length > 1 ? <ChevronRight size={16} /> : <Check size={16} />}{t(feed && feed.items.length > 1 ? 'ui.announcements.next' : 'ui.announcements.gotIt')}</button></footer>
  </section>, document.body)
}
