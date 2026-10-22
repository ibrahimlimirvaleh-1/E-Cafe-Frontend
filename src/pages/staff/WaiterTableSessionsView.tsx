import { i18n } from '../../shared/i18n/i18n'
import { CircleCheck, Clock3, RefreshCw, Store, Table2, Users, ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { serveWaiterOrder } from '../../features/orders/serveWaiterOrder'
import { ecafeApi, type WaiterReadyOrderResponse, type WaiterTableSessionResponse } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { orderStatusId } from '../../shared/lib/orderStatus'
import { Button } from '../../shared/ui/Button'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './waiter-sessions.css'

const emptySessions: PaginatedResponse<WaiterTableSessionResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasPreviousPage: false, hasNextPage: false,
}
const emptyReadyOrders: PaginatedResponse<WaiterReadyOrderResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasPreviousPage: false, hasNextPage: false,
}

type Props = {
  restaurantId: string
  restaurantName: string
  restaurantOptions: { id: string; name: string }[]
  onRestaurantChange: (restaurantId: string) => void
  reloadKey: number
  targetSessionId: number | null
  selectionKey: string
}

function tableLabel(session: Pick<WaiterTableSessionResponse, 'tableName' | 'tableNo'>) {
  return session.tableName?.trim() || `Masa-${session.tableNo}`
}

function sessionTime(value: string, timeZone: string) {
  return formatReservationDateTime(value, timeZone || 'Asia/Baku')
}

export function WaiterTableSessionsView({ restaurantId, restaurantName, restaurantOptions, onRestaurantChange, reloadKey, targetSessionId, selectionKey }: Props) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [readyPage, setReadyPage] = useState(1)
  const [activeSection, setActiveSection] = useState<'tables' | 'ready'>('tables')
  const [revision, setRevision] = useState(0)
  const [servingId, setServingId] = useState<number | null>(null)
  const [uncertain, setUncertain] = useState<WaiterReadyOrderResponse | null>(null)
  const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<number>>(() => new Set())
  const [confirmedOrderIds, setConfirmedOrderIds] = useState<Set<number>>(() => new Set())
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  useEffect(() => {
    if (restaurantId && targetSessionId !== null) navigate(`/waiter/restaurants/${restaurantId}/sessions/${targetSessionId}/orders`, { replace: true })
  }, [targetSessionId, selectionKey, navigate, restaurantId])

  const sessions = useKeyedAsyncData(
    () => restaurantId ? ecafeApi.tableSessions.listMine(restaurantId, page) : Promise.resolve(emptySessions),
    emptySessions, `${restaurantId}:${page}`, [reloadKey, revision],
  )
  const ready = useKeyedAsyncData(
    () => restaurantId ? ecafeApi.tableSessions.listReadyOrders(restaurantId, readyPage) : Promise.resolve(emptyReadyOrders),
    emptyReadyOrders, `${restaurantId}:${readyPage}`, [reloadKey, revision],
  )

  useEffect(() => {
    if (sessions.hasData && page > sessions.data.totalPages) setPage(Math.max(1, sessions.data.totalPages))
  }, [sessions.hasData, sessions.data.totalPages, page])
  useEffect(() => {
    if (ready.hasData && readyPage > ready.data.totalPages) setReadyPage(Math.max(1, ready.data.totalPages))
  }, [ready.hasData, ready.data.totalPages, readyPage])

  const readyItems = ready.error ? [] : ready.data.items.filter((entry) => !hiddenOrderIds.has(entry.order.id) && !confirmedOrderIds.has(entry.order.id))
  const pendingEntry = uncertain && !readyItems.some((item) => item.order.id === uncertain.order.id) ? uncertain : null

  function refresh() {
    setNotice('')
    setError('')
    setHiddenOrderIds(new Set())
    setRevision((value) => value + 1)
  }

  async function serve(entry: WaiterReadyOrderResponse) {
    const order = entry.order
    const sessionId = order.tableSessionId
    if (inFlight.current || (uncertain && uncertain.order.id !== order.id) || !restaurantId || !sessionId || !order.canMarkServed) return
    inFlight.current = true
    setServingId(order.id)
    setError('')
    setNotice('')
    try {
      if (uncertain?.order.id === order.id) {
        const current = await ecafeApi.tableSessions.getOrder(restaurantId, sessionId, order.id)
        if (current.statusId === orderStatusId.served && current.servedAt) {
          setUncertain(null)
          setConfirmedOrderIds((known) => new Set(known).add(order.id))
          setNotice(i18n.t('ui.waiter.orderServed', { id: order.id }))
          setRevision((value) => value + 1)
          return
        }
        if (!current.canMarkServed) {
          setUncertain(null)
          setError(i18n.t('ui.waiter.orderChanged'))
          setRevision((value) => value + 1)
          return
        }
      }
      await serveWaiterOrder(restaurantId, sessionId, order.id)
      setUncertain(null)
      setConfirmedOrderIds((known) => new Set(known).add(order.id))
      setNotice(i18n.t('ui.waiter.orderServed', { id: order.id }))
      setRevision((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (caught) {
      if (caught instanceof ApiError && [403, 404].includes(caught.statusCode)) {
        setUncertain(null)
        setHiddenOrderIds((current) => new Set(current).add(order.id))
        setError(i18n.t('ui.waiter.orderUnavailable'))
        setRevision((value) => value + 1)
      } else if (caught instanceof ApiError && [400, 409, 422].includes(caught.statusCode)) {
        setUncertain(null)
        setError(normalizeCaughtApiError(caught, i18n.t('ui.waiter.orderChanged')).message)
        setRevision((value) => value + 1)
      } else {
        setUncertain(entry)
        setError(i18n.t('ui.waiter.serveUnknown', { id: order.id }))
      }
    } finally {
      inFlight.current = false
      setServingId(null)
    }
  }

  return <section className="waiter-sessions-view" aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.xidmet_etdiyim_masalar_bcd05b')}>
    <div className="waiter-sessions-toolbar">
      {restaurantOptions.length > 1 ? <label className="waiter-sessions-restaurant">{i18n.t('ui.pages.staff.waiter_table_sessions_view.restoran_c4df56')}
        <select value={restaurantId} onChange={(event) => { setPage(1); setReadyPage(1); setActiveSection('tables'); setUncertain(null); setHiddenOrderIds(new Set()); setConfirmedOrderIds(new Set()); onRestaurantChange(event.target.value) }}>
          {restaurantOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label> : <div className="waiter-sessions-restaurant-name"><span>{i18n.t('ui.pages.staff.waiter_table_sessions_view.restoran_c4df56')}</span><strong><Store size={18} aria-hidden="true" />{restaurantName}</strong></div>}
      <Button type="button" variant="secondary" onClick={refresh} title={i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyalarini_yenile_305fb7')} aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyalarini_yenile_305fb7')}><RefreshCw size={18} /></Button>
    </div>
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_table_sessions_view.size_aid_restoran_tapilmadi_3fdf18')}</StatusMessage> : null}
    {notice ? <StatusMessage tone="success" autoHideMs={false}>{notice}</StatusMessage> : null}
    {error ? <StatusMessage tone={uncertain ? 'warning' : 'danger'} autoHideMs={false}>{error}</StatusMessage> : null}
    <div className="waiter-sessions-sections" role="group" aria-label={i18n.t('ui.pages.staff.waiter_dashboard_page.ofisiant_paneli_gorunusu_a7fa7e')}>
      <button type="button" aria-pressed={activeSection === 'tables'} className={activeSection === 'tables' ? 'is-active' : ''} onClick={() => setActiveSection('tables')}>{i18n.t('ui.waiter.tables')}<span>{sessions.hasData && !sessions.error ? sessions.data.totalCount : '—'}</span></button>
      <button type="button" aria-pressed={activeSection === 'ready'} className={activeSection === 'ready' ? 'is-active' : ''} onClick={() => setActiveSection('ready')}>{i18n.t('ui.waiter.readyOrders')}<span>{ready.hasData && !ready.error ? ready.data.totalCount : '—'}</span></button>
    </div>
    {activeSection === 'ready' ? <section className="waiter-ready-section" aria-label={i18n.t('ui.waiter.readyOrders')}>
      <div className="waiter-sessions-summary"><strong>{i18n.t('ui.waiter.readyOrders')} · {ready.hasData && !ready.error ? ready.data.totalCount : '—'}</strong>{ready.isRefreshing ? <span role="status">{i18n.t('ui.pages.staff.waiter_table_sessions_view.yenilenir_283de5')}</span> : null}</div>
      {ready.isLoading ? <p className="waiter-reservations-muted" role="status">{i18n.t('ui.pages.staff.waiter_session_orders_page.sifarisler_yuklenir_917624')}</p> : null}
      {ready.error ? <StatusMessage tone="danger" autoHideMs={false}>{ready.error}</StatusMessage> : null}
      {ready.hasData && !ready.error && readyItems.length === 0 && !pendingEntry ? <p className="waiter-ready-empty">{i18n.t('ui.waiter.noReadyOrders')}</p> : null}
      <div className="waiter-ready-list">{[...(pendingEntry ? [pendingEntry] : []), ...readyItems].map((entry) => <article className={`waiter-ready-row${uncertain?.order.id === entry.order.id ? ' is-uncertain' : ''}`} key={entry.order.id}>
        <div className="waiter-ready-info"><strong>{tableLabel(entry)} · {i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_96cfd8')}{entry.order.id}</strong><span>{sessionTime(entry.readyAt, entry.timeZone)} · {entry.order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</span></div>
        <div className="waiter-ready-actions"><Link to={`/waiter/restaurants/${restaurantId}/sessions/${entry.order.tableSessionId}/orders?orderId=${entry.order.id}`} aria-label={`${i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_96cfd8')}${entry.order.id} · ${i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detali_f143a4')}`} title={i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detali_f143a4')}><ArrowRight size={17} /><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detali_f143a4')}</span></Link><Button type="button" disabled={servingId !== null || Boolean(uncertain && uncertain.order.id !== entry.order.id) || !entry.order.canMarkServed} onClick={() => void serve(entry)}><CircleCheck size={17} />{servingId === entry.order.id ? i18n.t('ui.pages.staff.waiter_session_orders_page.qeyd_edilir_b735f7') : uncertain?.order.id === entry.order.id ? i18n.t('ui.waiter.checkServeResult') : i18n.t('ui.waiter.serve')}</Button></div>
      </article>)}</div>
      {ready.hasData && !ready.error ? <PaginationControls ariaLabel={i18n.t('ui.waiter.readyOrders')} pageIndex={ready.data.pageIndex} totalPages={ready.data.totalPages} hasNextPage={ready.data.hasNextPage} hasPreviousPage={ready.data.hasPreviousPage} totalCount={ready.data.totalCount} pageSize={20} onPageChange={setReadyPage} /> : null}
    </section> : <>
    {sessions.error ? <StatusMessage tone="danger" autoHideMs={false}>{sessions.error}</StatusMessage> : null}
    <div className="waiter-sessions-summary"><strong>{sessions.hasData && !sessions.error ? `${sessions.data.totalCount} açıq masa` : i18n.t('ui.pages.staff.waiter_table_sessions_view.aciq_masalar_94a704')}</strong>{sessions.isRefreshing ? <span role="status">{i18n.t('ui.pages.staff.waiter_table_sessions_view.yenilenir_283de5')}</span> : null}</div>
    {sessions.isLoading ? <p className="waiter-reservations-muted" role="status">{i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyalari_yuklenir_e3e0bd')}</p> : null}
    {!sessions.isLoading && !sessions.error && sessions.hasData && sessions.data.items.length === 0 ? <div className="waiter-reservations-empty" role="status">
      <span className="waiter-reservations-empty-icon"><Table2 size={22} aria-hidden="true" /></span>
      <div><strong>{i18n.t('ui.pages.staff.waiter_table_sessions_view.aciq_masa_sessiyasi_yoxdur_2d0a73')}</strong><p>{i18n.t('ui.pages.staff.waiter_table_sessions_view.hazirda_size_teyin_edilmis_aciq_masa_t_18df8e')}</p></div>
    </div> : null}
    {sessions.hasData && !sessions.error && sessions.data.items.length > 0 ? <div className="waiter-sessions-list" aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.aciq_masa_sessiyalari_8304f2')}>
      {sessions.data.items.map((session) => <button className="waiter-session-row" type="button" key={session.id} onClick={() => navigate(`/waiter/restaurants/${restaurantId}/sessions/${session.id}/orders`)}>
        <span className="waiter-session-row-heading"><span className="waiter-session-table"><Table2 size={18} aria-hidden="true" />{tableLabel(session)}</span><span className={`waiter-session-state${session.requiresCloseReview ? ' is-review' : ''}`}>{session.requiresCloseReview ? i18n.t('ui.pages.staff.waiter_table_sessions_view.baglanmasi_yoxlanmalidir_87b96f') : i18n.t('ui.pages.staff.waiter_table_sessions_view.xidmetde_3015e9')}</span></span>
        <span className="waiter-session-row-meta"><span><Clock3 size={15} aria-hidden="true" />{sessionTime(session.openedAt, session.timeZone)}</span><span><Users size={15} aria-hidden="true" />{session.peopleCount == null ? i18n.t('ui.pages.staff.waiter_table_sessions_view.qonaq_sayi_qeyd_olunmayib_98c6e4') : `${session.peopleCount} nəfər`}</span></span>
        {session.customerName ? <span className="waiter-session-customer">{session.customerName}</span> : null}
        {session.readyOrderCount > 0 || session.unsentOrderCount > 0 ? <span className="waiter-session-counts">{session.readyOrderCount > 0 ? <span className="is-ready">{i18n.t('ui.waiter.readyCount', { count: session.readyOrderCount })}</span> : null}{session.unsentOrderCount > 0 ? <span>{i18n.t('ui.waiter.unsentCount', { count: session.unsentOrderCount })}</span> : null}</span> : null}
      </button>)}
    </div> : null}
    {sessions.hasData && !sessions.error ? <PaginationControls ariaLabel={i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyasi_sehifeleri_a19e6e')} pageIndex={sessions.data.pageIndex} totalPages={sessions.data.totalPages} hasNextPage={sessions.data.hasNextPage} hasPreviousPage={sessions.data.hasPreviousPage} totalCount={sessions.data.totalCount} pageSize={20} onPageChange={setPage} /> : null}
    </>}
  </section>
}
