import { ArrowLeft, ArrowRight, CalendarClock, Check, Clock3, ReceiptText, RefreshCw, Table2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { StatusTone } from '../../entities/types'
import { ecafeApi, type CustomerSessionOrderResponse, type CustomerTableSessionResponse } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { orderKitchenLabel, orderStatusId } from '../../shared/lib/orderStatus'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import './customer-orders.css'

type QueryError = { statusCode?: number; message: string }
type QueryState<T> = { scope: string; data: T | null; error: QueryError | null; loading: boolean }

// Sorğu konteksti dəyişəndə əvvəlki müştəri və ya sessiyanın cavabını göstərmir.
function useScopedQuery<T>(scope: string, enabled: boolean, refresh: number, loader: (signal: AbortSignal) => Promise<T>) {
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const [state, setState] = useState<QueryState<T>>({ scope: '', data: null, error: null, loading: false })

  useEffect(() => {
    if (!enabled) {
      setState((previous) => previous.data === null && previous.error === null && !previous.loading
        ? previous : { scope, data: null, error: null, loading: false })
      return
    }
    const controller = new AbortController()
    let active = true
    // Eyni kontekstdə fon yoxlaması mövcud məzmunu və onun ölçülərini dəyişmir.
    setState((previous) => {
      if (previous.scope === scope && previous.data !== null) return previous
      if (previous.scope === scope && previous.loading) return previous
      return { scope, data: null, error: null, loading: true }
    })
    void loaderRef.current(controller.signal).then((data) => {
      if (active) setState((previous) => {
        if (previous.scope === scope && previous.error === null && !previous.loading && JSON.stringify(previous.data) === JSON.stringify(data)) return previous
        return { scope, data, error: null, loading: false }
      })
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return
      const normalized = normalizeCaughtApiError(error, 'Məlumat yüklənmədi.')
      const restricted = error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 404)
      setState((previous) => ({
        scope,
        data: restricted ? null : previous.scope === scope ? previous.data : null,
        error: { statusCode: normalized.statusCode, message: normalized.message },
        loading: false,
      }))
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [scope, enabled, refresh])

  return state.scope === scope && enabled
    ? state
    : { scope, data: null, error: null, loading: enabled } as QueryState<T>
}

// URL-dən yalnız təhlükəsiz, müsbət ID qəbul edir.
function positiveId(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

// İcazə və tapılmama xətalarını müştəriyə aydın şəkildə təqdim edir.
function errorMessage(error: QueryError, resource: string) {
  if (error.statusCode === 403) return 'Bu məlumatlara baxmaq icazəniz yoxdur.'
  if (error.statusCode === 404) return `${resource} tapılmadı və ya artıq əlçatan deyil.`
  return error.message
}

// Masa sessiyasının server statusunu qısa təqdimata çevirir.
function sessionStatus(statusId: number): { label: string; tone: StatusTone } {
  if (statusId === 7001) return { label: 'Aktiv', tone: 'success' }
  if (statusId === 7002) return { label: 'Bağlanıb', tone: 'neutral' }
  if (statusId === 7003) return { label: 'Ləğv edilib', tone: 'danger' }
  return { label: 'Vəziyyət yenilənir', tone: 'neutral' }
}

// Sifariş statusunun vizual tonunu təyin edir.
function orderTone(statusId: number): StatusTone {
  if (statusId === orderStatusId.cancelled) return 'danger'
  if (statusId === orderStatusId.ready || statusId === orderStatusId.served || statusId === orderStatusId.closed) return 'success'
  if (statusId === orderStatusId.preparing || statusId === orderStatusId.accepted) return 'info'
  return 'warning'
}

// Sifarişdəki məhsulların cəmini AZN formatında göstərir.
function money(amount: number) {
  return `${amount.toFixed(2)} AZN`
}

// Yalnız serverdə vaxtı olan mərhələlər tamamlanmış kimi görünür.
function OrderDetail({ order, timeZone, onClose }: { order: CustomerSessionOrderResponse; timeZone: string; onClose: () => void }) {
  const milestones = [
    { label: 'Sifariş yaradıldı', at: order.openedAt },
    { label: 'Mətbəxə göndərildi', at: order.sentToKitchenAt },
    { label: 'Mətbəx qəbul etdi', at: order.acceptedAt },
    { label: 'Hazırlanmağa başladı', at: order.preparingAt },
    { label: 'Hazırlandı', at: order.readyAt },
    { label: 'Təqdim edildi', at: order.servedAt },
    { label: 'Bağlandı', at: order.closedAt },
  ].filter((step) => Boolean(step.at))

  return <section className="customer-order-detail" aria-label={`Sifariş #${order.id} detalı`}>
    <div className="customer-order-detail-heading">
      <div><span className="customer-orders-kicker">Sifariş #{order.id}</span><h3>Sifariş detalı</h3></div>
      <button aria-label="Sifariş detalını bağla" onClick={onClose} title="Bağla" type="button"><X size={18} /></button>
    </div>
    <div className="customer-order-detail-summary">
      <Badge tone={orderTone(order.statusId)}>{orderKitchenLabel(order.statusId, order.sentToKitchenAt)}</Badge>
      <span className="customer-order-amount"><small>Məhsul cəmi</small><strong>{money(order.subtotal)}</strong></span>
    </div>
    <ul className="customer-order-lines">
      {order.items.map((item) => <li key={item.id}>
        <span><strong>{item.quantity} × {item.name}</strong><small>{money(item.unitPrice)} / ədəd</small></span>
        <strong>{money(item.lineTotal)}</strong>
      </li>)}
    </ul>
    <div className="customer-order-progress">
      <h4>Gedişat</h4>
      <ol>{milestones.map((step) => <li key={step.label}><Check size={15} aria-hidden="true" /><span>{step.label}</span><time>{formatReservationDateTime(step.at, timeZone)}</time></li>)}</ol>
      {order.statusId === orderStatusId.created && !order.sentToKitchenAt ? <p>Mətbəxə göndərilməsini gözləyir.</p> : null}
    </div>
  </section>
}

// Müştərinin öz masa sessiyalarını və sifarişlərini yalnız oxumaq üçün göstərir.
export function MyOrdersPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sessionPage, setSessionPage] = useState(1)
  const [orderPage, setOrderPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [autoSession, setAutoSession] = useState<{ scope: string; id: number } | null>(null)
  const lastRefreshRef = useRef(0)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const isCustomer = isInRole(user, [RoleIds.Customer])
  const userScope = `${user?.userId ?? ''}:${user?.roleId ?? ''}`
  const requestedSessionId = positiveId(searchParams.get('sessionId'))
  const requestedOrderId = positiveId(searchParams.get('orderId'))

  useEffect(() => {
    if (!isCustomer) return
    const refresh = () => {
      if (document.hidden || Date.now() - lastRefreshRef.current < 1000) return
      lastRefreshRef.current = Date.now()
      setRevision((value) => value + 1)
    }
    const onVisible = () => { if (!document.hidden) refresh() }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('ecafe:notifications-refresh', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isCustomer])

  const sessions = useScopedQuery<PaginatedResponse<CustomerTableSessionResponse>>(
    `${userScope}:sessions:${sessionPage}`, isCustomer, revision,
    (signal) => ecafeApi.customerTableSessions.listMine(sessionPage, 10, signal),
  )
  const selectionScope = `${userScope}:sessions:${sessionPage}`
  const sessionId = requestedSessionId ?? (sessions.data?.items.length
    ? autoSession?.scope === selectionScope ? autoSession.id : sessions.data.items[0].id
    : null)
  useEffect(() => {
    const first = sessions.data?.items[0]?.id
    if (!isCustomer || first === undefined) return
    // Yeni sessiya siyahının əvvəlinə gələndə artıq seçilmiş sessiyanı dəyişmir.
    setAutoSession((previous) => previous?.scope === selectionScope ? previous : { scope: selectionScope, id: first })
  }, [isCustomer, selectionScope, sessions.data])
  const selectedSession = useScopedQuery<CustomerTableSessionResponse>(
    `${userScope}:session:${sessionId}`, isCustomer && sessionId !== null, revision,
    (signal) => ecafeApi.customerTableSessions.getById(sessionId!, signal),
  )
  const validSession = selectedSession.data?.id === sessionId ? selectedSession.data : null
  const orders = useScopedQuery<PaginatedResponse<CustomerSessionOrderResponse>>(
    `${userScope}:orders:${sessionId}:${orderPage}`, isCustomer && validSession !== null, revision,
    (signal) => ecafeApi.customerTableSessions.listOrders(sessionId!, orderPage, 10, signal),
  )
  const selectedOrder = useScopedQuery<CustomerSessionOrderResponse>(
    `${userScope}:order:${sessionId}:${requestedOrderId}`, isCustomer && validSession !== null && requestedOrderId !== null, revision,
    (signal) => ecafeApi.customerTableSessions.getOrder(sessionId!, requestedOrderId!, signal),
  )

  useEffect(() => { setOrderPage(1) }, [sessionId])
  useEffect(() => {
    if (!sessions.loading && sessions.data && sessionPage > sessions.data.totalPages && sessions.data.totalPages > 0) setSessionPage(sessions.data.totalPages)
  }, [sessions.data, sessions.loading, sessionPage])
  useEffect(() => {
    if (!orders.loading && orders.data && orderPage > orders.data.totalPages && orders.data.totalPages > 0) setOrderPage(orders.data.totalPages)
  }, [orders.data, orders.loading, orderPage])

  // Yeni sessiya seçiləndə köhnə sifariş detalını URL-dən çıxarır.
  function chooseSession(id: number) {
    if (id === sessionId) return
    setOrderPage(1)
    const next = new URLSearchParams(searchParams)
    next.set('sessionId', String(id))
    next.delete('orderId')
    setSearchParams(next)
    if (window.matchMedia('(max-width: 850px)').matches) {
      window.requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  // Sifariş detalını paylaşılabilən URL ilə açır və bağlayır.
  function chooseOrder(id: number | null) {
    const next = new URLSearchParams(searchParams)
    if (sessionId) next.set('sessionId', String(sessionId))
    if (id) next.set('orderId', String(id))
    else next.delete('orderId')
    setSearchParams(next)
    if (id && window.matchMedia('(max-width: 850px)').matches) {
      window.requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  return <main className="page customer-orders-page">
    <PageHeader eyebrow="Hesab" title="Sifarişlərim" description="Masa sessiyalarınızı və sifarişlərin hazırlanma gedişatını izləyin."
      action={<Button aria-label="Sifarişləri yenilə" title="Sifarişləri yenilə" variant="secondary" onClick={() => setRevision((value) => value + 1)} type="button"><RefreshCw size={17} /><span>Yenilə</span></Button>} />

    <div className="customer-orders-layout">
      <section className="customer-order-sessions" aria-label="Masa sessiyaları">
        <div className="customer-orders-section-heading"><div><span className="customer-orders-kicker">Tarixçə</span><h2>Masa sessiyaları</h2></div>{sessions.data ? <small>{sessions.data.totalCount} sessiya</small> : null}</div>
        {sessions.error ? <p className="customer-orders-error" role="alert">{errorMessage(sessions.error, 'Sessiyalar')}</p> : null}
        {sessions.loading && !sessions.data ? <p className="customer-orders-muted" role="status">Sessiyalar yüklənir...</p> : null}
        {sessions.data?.items.length === 0 ? <div className="customer-orders-empty"><Table2 size={24} /><h3>Hələ masa sessiyanız yoxdur</h3><p>Restoranda masa sessiyanız açıldıqda sifarişləriniz burada görünəcək.</p><ButtonLink to="/reservations" variant="secondary">Rezervasiyalarıma bax</ButtonLink></div> : null}
        {sessions.data?.items.length ? <div className="customer-order-session-picker">
          <label htmlFor="customer-order-session-select">Restoran və masa</label>
          <select id="customer-order-session-select" value={sessionId ?? ''} onChange={(event) => chooseSession(Number(event.target.value))}>
            {sessionId !== null && !sessions.data.items.some((session) => session.id === sessionId) ? <option value={sessionId}>{validSession ? `${validSession.restaurantName} · ${validSession.tableName}` : `Sessiya #${sessionId}`}</option> : null}
            {sessions.data.items.map((session) => <option key={session.id} value={session.id}>{session.restaurantName || `Restoran #${session.restaurantId}`} · {session.tableName || `Masa #${session.tableId}`} · #{session.id}</option>)}
          </select>
        </div> : null}
        <div className="customer-order-session-items">{sessions.data?.items.map((session) => {
          const status = sessionStatus(session.statusId)
          return <button className={`customer-order-session${session.id === sessionId ? ' is-selected' : ''}`} type="button" key={session.id} aria-pressed={session.id === sessionId} onClick={() => chooseSession(session.id)}>
            <span className="customer-order-session-top"><strong>{session.restaurantName || `Restoran #${session.restaurantId}`}</strong><Badge tone={status.tone}>{status.label}</Badge></span>
            <span className="customer-order-session-meta"><Table2 size={15} />{session.tableName || `Masa #${session.tableId}`}</span>
            <span className="customer-order-session-meta"><CalendarClock size={15} />{formatReservationDateTime(session.openedAt, session.timeZone)}</span>
          </button>
        })}</div>
        {sessions.data ? <PaginationControls ariaLabel="Masa sessiyaları səhifələməsi" hasNextPage={sessions.data.hasNextPage} hasPreviousPage={sessions.data.hasPreviousPage} pageIndex={sessions.data.pageIndex} totalPages={sessions.data.totalPages} totalCount={sessions.data.totalCount} onPageChange={setSessionPage} /> : null}
      </section>

      <section className={`customer-order-workspace${requestedOrderId !== null ? ' has-open-detail' : ''}`} aria-label="Sessiyanın sifarişləri" ref={workspaceRef}>
        {sessionId === null ? <div className="customer-orders-placeholder"><ReceiptText size={28} /><h2>Sifarişləriniz burada görünəcək</h2><p>Masa sessiyası seçin və sifarişlərin gedişatına baxın.</p></div> : null}
        {sessionId !== null && selectedSession.loading && !validSession ? <p className="customer-orders-muted" role="status">Sessiya yüklənir...</p> : null}
        {sessionId !== null && selectedSession.error && !validSession ? <div className="customer-orders-empty"><h2>Sessiya əlçatan deyil</h2><p role="alert">{errorMessage(selectedSession.error, 'Sessiya')}</p><Button variant="secondary" onClick={() => { if (requestedSessionId) { const next = new URLSearchParams(searchParams); next.delete('sessionId'); next.delete('orderId'); setSearchParams(next) } else setRevision((value) => value + 1) }} type="button">{requestedSessionId ? 'Siyahıya qayıt' : 'Yenidən yoxla'}</Button></div> : null}
        {validSession ? <>
          <div className="customer-orders-section-heading customer-order-workspace-heading"><div><span className="customer-orders-kicker">{validSession.restaurantName || 'Restoran'}</span><h2>{validSession.tableName || `Masa #${validSession.tableId}`}</h2><p><Clock3 size={15} /> Açılış: {formatReservationDateTime(validSession.openedAt, validSession.timeZone)}</p></div><Badge tone={sessionStatus(validSession.statusId).tone}>{sessionStatus(validSession.statusId).label}</Badge></div>
          {selectedSession.error ? <p className="customer-orders-error" role="alert">Sessiya yenilənmədi. Son yüklənmiş məlumat göstərilir.</p> : null}
          {requestedOrderId !== null ? <button className="customer-order-detail-back" onClick={() => chooseOrder(null)} type="button"><ArrowLeft size={17} />Sifarişlərə qayıt</button> : null}
          {requestedOrderId !== null && selectedOrder.loading && !selectedOrder.data ? <p className="customer-orders-muted" role="status">Sifariş detalı yüklənir...</p> : null}
          {requestedOrderId !== null && selectedOrder.error ? <p className="customer-orders-error" role="alert">{errorMessage(selectedOrder.error, 'Sifariş')}</p> : null}
          {selectedOrder.data ? <OrderDetail order={selectedOrder.data} timeZone={validSession.timeZone} onClose={() => chooseOrder(null)} /> : null}
          <div className="customer-order-list-area">
            {orders.error ? <p className="customer-orders-error" role="alert">{errorMessage(orders.error, 'Sifarişlər')}</p> : null}
            {orders.loading && !orders.data ? <p className="customer-orders-muted" role="status">Sifarişlər yüklənir...</p> : null}
            {orders.data?.items.length === 0 ? <div className="customer-orders-empty"><ReceiptText size={25} /><h3>Bu sessiyada hələ sifariş yoxdur</h3><p>Sifariş yaradıldıqda onun gedişatı burada görünəcək.</p></div> : null}
            {orders.data && orders.data.items.length > 0 ? <div className="customer-order-list"><h3>Sifarişlər <span>{orders.data.totalCount}</span></h3>{orders.data.items.map((order) => <article className="customer-order-row" key={order.id}>
              <div className="customer-order-row-main"><span className="customer-orders-kicker">Sifariş #{order.id}</span><strong>{order.items.length ? order.items.map((item) => item.name).join(', ') : 'Məhsul məlumatı yoxdur'}</strong><small>{formatReservationDateTime(order.openedAt, validSession.timeZone)} · {order.items.length} məhsul</small></div>
              <div className="customer-order-row-action"><span className="customer-order-amount"><small>Məhsul cəmi</small><strong>{money(order.subtotal)}</strong></span><Badge tone={orderTone(order.statusId)}>{orderKitchenLabel(order.statusId, order.sentToKitchenAt)}</Badge><button aria-label={`Sifariş #${order.id} detalına bax`} onClick={() => chooseOrder(order.id)} title="Detallara bax" type="button"><ArrowRight size={18} /></button></div>
            </article>)}</div> : null}
            {orders.data ? <PaginationControls ariaLabel="Sifarişlər səhifələməsi" hasNextPage={orders.data.hasNextPage} hasPreviousPage={orders.data.hasPreviousPage} pageIndex={orders.data.pageIndex} totalPages={orders.data.totalPages} totalCount={orders.data.totalCount} onPageChange={setOrderPage} /> : null}
          </div>
        </> : null}
      </section>
    </div>
  </main>
}
