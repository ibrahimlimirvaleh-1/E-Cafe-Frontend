import { i18n } from '../../shared/i18n/i18n'
import { ArrowLeft, CircleCheck, LoaderCircle, Minus, Plus, RefreshCw, Search, SendHorizontal, ShoppingBasket, Table2, Trash2, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import type { MenuItem } from '../../entities/types'
import { clearPendingOrderIntent, pendingOrderStorageKey, readPendingOrderIntent, savePendingOrderIntent, type PendingOrderIntent } from '../../features/orders/pendingOrderIntent'
import { ecafeApi, type CreateSessionOrderRequest, type SessionBillResponse, type SessionOrderResponse, type WaiterTableSessionResponse } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { orderKitchenLabel, orderStatusId } from '../../shared/lib/orderStatus'
import { paymentStatusId } from '../../shared/lib/paymentStatus'
import { SessionBillPanel } from '../../features/settlement/SessionBillPanel'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './waiter-orders.css'

type CartLine = { item: MenuItem; quantity: number; note: string }
type OrderDetail = { kind: 'found'; order: SessionOrderResponse } | { kind: 'missing' }

const emptyOrders: PaginatedResponse<SessionOrderResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasPreviousPage: false, hasNextPage: false,
}

// Bir masa sifarişinin məbləğini yalnız məhsul cəmi kimi göstərir.
function money(amount: number) {
  return `${amount.toFixed(2)} AZN`
}

// Ekrandakı qiyməti serverə yalnız gözlənilən qiymət kimi ötürür.
function buildOrderBody(cart: CartLine[], note: string): CreateSessionOrderRequest {
  const trimmedNote = note.trim()
  return {
    ...(trimmedNote ? { note: trimmedNote } : {}),
    items: cart.map((line) => ({
      itemId: Number(line.item.id),
      quantity: line.quantity,
      ...(line.note.trim() ? { note: line.note.trim() } : {}),
      expectedUnitPrice: line.item.price,
    })),
  }
}

// Seçilmiş sifarişin dəyişməz məzmununu göstərir; onClose yalnız detalı bağlayır.
function OrderSummary({ order, timeZone, onClose, onSend, onServe, sending, serving, canSend, canServe, retrying, retryingServe }: { order: SessionOrderResponse; timeZone?: string; onClose: () => void; onSend: () => void; onServe: () => void; sending: boolean; serving: boolean; canSend: boolean; canServe: boolean; retrying: boolean; retryingServe: boolean }) {
  const canDispatch = order.statusId === orderStatusId.created && !order.sentToKitchenAt
  return <div className="waiter-order-summary">
    <div className="waiter-order-summary-heading"><div><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_cccd19')}{order.id}</span><h3>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detali_f143a4')}</h3></div><div><strong>{money(order.subtotal)}</strong><button type="button" aria-label={i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detalini_bagla_06f965')} title={i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detalini_bagla_06f965')} onClick={onClose}><X size={16} /></button></div></div>
    <p>{formatReservationDateTime(order.openedAt, timeZone)} · <strong>{orderKitchenLabel(order.statusId, order.sentToKitchenAt)}</strong></p>
    {order.sentToKitchenAt ? <p>{i18n.t('ui.pages.staff.waiter_session_orders_page.metbexe_gonderilib_80fafd')} {formatReservationDateTime(order.sentToKitchenAt, timeZone)}</p> : null}
    {order.servedAt ? <p>{i18n.t('ui.pages.staff.waiter_session_orders_page.teqdim_edilib_00b1bf')} {formatReservationDateTime(order.servedAt, timeZone)}</p> : null}
    <ul>{order.items.map((line) => <li key={line.id}><span><strong>{line.quantity} × {line.name}</strong>{line.note ? <small>{line.note}</small> : null}</span><strong>{money(line.lineTotal)}</strong></li>)}</ul>
    {order.note ? <p className="waiter-order-note">{i18n.t('ui.pages.staff.waiter_session_orders_page.qeyd_2d4f8a')} {order.note}</p> : null}
    {canDispatch ? <Button type="button" className="waiter-order-dispatch" disabled={!canSend || sending} onClick={onSend}>
      {sending ? <LoaderCircle className="waiter-order-dispatch-spinner" size={17} /> : <SendHorizontal size={17} />}
      {sending ?i18n.t('ui.pages.staff.waiter_session_orders_page.gonderilir_e1bb27') : retrying ?i18n.t('ui.pages.staff.waiter_session_orders_page.eyni_sifarisi_tekrar_gonder_a76b51') :i18n.t('ui.pages.staff.waiter_session_orders_page.metbexe_gonder_784c49')}
    </Button> : null}
    {order.canMarkServed ? <Button type="button" className="waiter-order-serve" disabled={!canServe || serving} onClick={onServe}>
      {serving ? <LoaderCircle className="waiter-order-dispatch-spinner" size={17} /> : <CircleCheck size={17} />}
      {serving ?i18n.t('ui.pages.staff.waiter_session_orders_page.qeyd_edilir_b735f7') : retryingServe ?i18n.t('ui.pages.staff.waiter_session_orders_page.eyni_sifarisin_neticesini_yoxla_770efa') :i18n.t('ui.pages.staff.waiter_session_orders_page.teqdim_edildi_kimi_qeyd_et_9c9318')}
    </Button> : null}
  </div>
}

export function WaiterSessionOrdersPage() {
  const { user, selectProfile } = useAuth()
  const { restaurantId = '', sessionId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const parsedSessionId = Number(sessionId)
  const requestedOrderId = searchParams.get('orderId')
  const readyOrderId = requestedOrderId && Number.isSafeInteger(Number(requestedOrderId)) && Number(requestedOrderId) > 0
    ? requestedOrderId : null
  const readyLinkKey = `${restaurantId}:${sessionId}:${readyOrderId}`
  const profileSelectionKeyRef = useRef('')
  const hasWaiterProfile = isInRole(user, [RoleIds.Waiter], restaurantId)

  useEffect(() => {
    if (!user || !readyOrderId || !hasWaiterProfile || !Number.isSafeInteger(parsedSessionId) || parsedSessionId <= 0 ||
      profileSelectionKeyRef.current === readyLinkKey) return
    profileSelectionKeyRef.current = readyLinkKey
    if (user.restaurantId !== restaurantId || user.roleId !== RoleIds.Waiter) {
      selectProfile({ restaurantId, roleId: RoleIds.Waiter })
    }
  }, [user, readyOrderId, readyLinkKey, hasWaiterProfile, parsedSessionId, restaurantId, selectProfile])

  if (!user || !hasWaiterProfile || !Number.isSafeInteger(parsedSessionId) || parsedSessionId <= 0) {
    return <Navigate to="/waiter?view=tables" replace />
  }
  if (user.restaurantId !== restaurantId || user.roleId !== RoleIds.Waiter) {
    return readyOrderId ? <main className="staff-page" role="status">{i18n.t('ui.pages.staff.waiter_session_orders_page.restoran_konteksti_yuklenir_4dcead')}</main> : <Navigate to="/waiter?view=tables" replace />
  }

  return <SessionOrderWorkspace key={`${user.userId}:${restaurantId}:${parsedSessionId}`} userId={user.userId} restaurantId={restaurantId} sessionId={parsedSessionId} />
}

function SessionOrderWorkspace({ userId, restaurantId, sessionId }: { userId: string; restaurantId: string; sessionId: number }) {
  const [searchParams] = useSearchParams()
  const requestedOrderId = searchParams.get('orderId')
  const parsedRequestedOrderId = Number(requestedOrderId)
  const validRequestedOrderId = requestedOrderId && Number.isSafeInteger(parsedRequestedOrderId) && parsedRequestedOrderId > 0 ? parsedRequestedOrderId : null
  const storageKey = pendingOrderStorageKey(userId, restaurantId, sessionId)
  const [pendingIntent, setPendingIntent] = useState<PendingOrderIntent | null>(() => readPendingOrderIntent(storageKey))
  const [cart, setCart] = useState<CartLine[]>([])
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [menuRevision, setMenuRevision] = useState(0)
  const [ordersRevision, setOrdersRevision] = useState(0)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(validRequestedOrderId)
  const [createdOrder, setCreatedOrder] = useState<SessionOrderResponse | null>(null)
  const [feedback, setFeedback] = useState(pendingIntent ? 'Əvvəlki sifariş cəhdinin nəticəsi bilinmir. Eyni cəhdi yenidən yoxlayın.' : '')
  const [priceConflict, setPriceConflict] = useState(false)
  const [keyConflict, setKeyConflict] = useState(false)
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sendingOrderId, setSendingOrderId] = useState<number | null>(null)
  const [uncertainOrderId, setUncertainOrderId] = useState<number | null>(null)
  const [dispatchError, setDispatchError] = useState('')
  const [dispatchNotice, setDispatchNotice] = useState('')
  const [sentOrderTimes, setSentOrderTimes] = useState<Record<number, string>>({})
  const [servingOrderId, setServingOrderId] = useState<number | null>(null)
  const [uncertainServedId, setUncertainServedId] = useState<number | null>(null)
  const [serveError, setServeError] = useState('')
  const [serveNotice, setServeNotice] = useState('')
  const [servedOrders, setServedOrders] = useState<Record<number, SessionOrderResponse>>({})
  const [serveAccessDenied, setServeAccessDenied] = useState(false)
  const [bill, setBill] = useState<SessionBillResponse | null>(null)
  const inFlightRef = useRef(false)
  const sendInFlightRef = useRef(false)
  const serveInFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const scopeKey = `${restaurantId}:${sessionId}`

  useEffect(() => {
    if (validRequestedOrderId !== null) setSelectedOrderId(validRequestedOrderId)
  }, [validRequestedOrderId])

  useEffect(() => {
    mountedRef.current = true
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 30_000)
    return () => {
      mountedRef.current = false
      window.removeEventListener('ecafe:notifications-refresh', refresh)
      window.clearInterval(timer)
    }
  }, [])

  const session = useKeyedAsyncData<WaiterTableSessionResponse | null>(
    async () => {
      try { return await ecafeApi.tableSessions.getMineById(restaurantId, sessionId) }
      catch (error) { if (error instanceof ApiError && error.statusCode === 404) return null; throw error }
    }, null, scopeKey, [reloadKey],
  )
  const menu = useKeyedAsyncData(
    () => ecafeApi.menu.publicMenuStrict(restaurantId),
    { categories: [], items: [] } as Awaited<ReturnType<typeof ecafeApi.menu.publicMenuStrict>>,
    restaurantId, [menuRevision],
  )
  const ordersKey = `${scopeKey}:${page}`
  const orders = useKeyedAsyncData<PaginatedResponse<SessionOrderResponse> | null>(
    async () => {
      try { return await ecafeApi.tableSessions.listOrders(restaurantId, sessionId, page) }
      catch (error) { if (error instanceof ApiError && error.statusCode === 404) return null; throw error }
    },
    emptyOrders, ordersKey, [reloadKey, ordersRevision],
  )
  const detailKey = selectedOrderId === null ? '' : `${scopeKey}:${selectedOrderId}`
  const detail = useKeyedAsyncData<OrderDetail | null>(
    async () => {
      if (selectedOrderId === null) return null
      try { return { kind: 'found', order: await ecafeApi.tableSessions.getOrder(restaurantId, sessionId, selectedOrderId) } }
      catch (error) { if (error instanceof ApiError && error.statusCode === 404) return { kind: 'missing' }; throw error }
    }, null, detailKey, [reloadKey, ordersRevision],
  )

  useEffect(() => {
    if (!detail.hasData || detail.data?.kind !== 'missing') return
    setSelectedOrderId(null)
    setFeedback('Sifariş artıq bu sessiyada tapılmır. Siyahı yeniləndi.')
    setOrdersRevision((value) => value + 1)
  }, [detail.data, detail.hasData])

  useEffect(() => {
    if (orders.hasData && orders.data && page > orders.data.totalPages) {
      setPage(Math.max(1, orders.data.totalPages))
      setSelectedOrderId(null)
    }
  }, [orders.data, orders.hasData, page])

  const sessionUnavailable = closed || serveAccessDenied || (session.hasData && !session.data && !session.error) || (orders.hasData && !orders.data && !orders.error)
  const billPaymentPending = bill?.latestPayment?.statusId === paymentStatusId.pending
  const canEdit = Boolean(session.hasData && session.data && !session.error && bill?.isOpen && !billPaymentPending && !pendingIntent && !busy && !sessionUnavailable)
  const visibleItems = useMemo(() => menu.hasData && !menu.error
    ? menu.data.items.filter((item) => item.isActive && (categoryId === 'all' || item.categoryId === categoryId) &&
      item.name.toLocaleLowerCase('az').includes(search.trim().toLocaleLowerCase('az')))
    : [], [menu.hasData, menu.error, menu.data.items, categoryId, search])
  const subtotal = cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0)
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const selectedOrderRecord = detail.hasData && detail.data?.kind === 'found' && !detail.error ? detail.data.order : null
  const selectedOrder = selectedOrderRecord && servedOrders[selectedOrderRecord.id] && !selectedOrderRecord.servedAt && selectedOrderRecord.statusId === orderStatusId.ready
    ? servedOrders[selectedOrderRecord.id]
    : selectedOrderRecord && sentOrderTimes[selectedOrderRecord.id]
      ? { ...selectedOrderRecord, sentToKitchenAt: sentOrderTimes[selectedOrderRecord.id] }
      : selectedOrderRecord
  const orderPage = orders.hasData && !orders.error ? orders.data : null
  const pendingBody = pendingIntent ? JSON.parse(pendingIntent.payload) as CreateSessionOrderRequest : null
  const uncertainOrderConfirmed = uncertainOrderId !== null && Boolean(
    (selectedOrderRecord?.id === uncertainOrderId && selectedOrderRecord.sentToKitchenAt) ||
    orderPage?.items.find((order) => order.id === uncertainOrderId)?.sentToKitchenAt,
  )

  useEffect(() => {
    if (!uncertainOrderConfirmed || uncertainOrderId === null) return
    setUncertainOrderId(null)
    setDispatchError('')
    setDispatchNotice(`Sifariş #${uncertainOrderId} mətbəxə göndərildi.`)
  }, [uncertainOrderConfirmed, uncertainOrderId])

  const uncertainServeConfirmed = uncertainServedId !== null && Boolean(
    (selectedOrderRecord?.id === uncertainServedId && selectedOrderRecord.servedAt) ||
    orderPage?.items.find((order) => order.id === uncertainServedId)?.servedAt,
  )
  useEffect(() => {
    if (!uncertainServeConfirmed || uncertainServedId === null) return
    setUncertainServedId(null)
    setServeError('')
    setServeNotice(`Sifariş #${uncertainServedId} təqdim edildi.`)
  }, [uncertainServeConfirmed, uncertainServedId])

  // Cavabı itmiş göndərmə yalnız həmin sifariş ID-si ilə təkrarlanır; yeni sifariş yaradılmır.
  async function sendToKitchen(orderId: number) {
    if (sendInFlightRef.current || sessionUnavailable || session.error || busy) return
    sendInFlightRef.current = true
    setSendingOrderId(orderId)
    setDispatchError('')
    setDispatchNotice('')
    try {
      const updated = await ecafeApi.tableSessions.sendOrderToKitchen(restaurantId, sessionId, orderId)
      if (updated.id !== orderId || !updated.sentToKitchenAt) throw new Error('Göndərmə cavabı təsdiqlənmədi.')
      if (!mountedRef.current) return
      setSentOrderTimes((current) => ({ ...current, [orderId]: updated.sentToKitchenAt! }))
      setUncertainOrderId(null)
      setCreatedOrder(null)
      setDispatchNotice(`Sifariş #${orderId} mətbəxə göndərildi.`)
      setOrdersRevision((value) => value + 1)
    } catch (error) {
      if (!mountedRef.current) return
      if (error instanceof ApiError && [400, 403, 404, 409, 422].includes(error.statusCode)) {
        setUncertainOrderId(null)
        setDispatchError(normalizeCaughtApiError(error, 'Sifariş mətbəxə göndərilə bilmədi.').message)
        setOrdersRevision((value) => value + 1)
      } else {
        setUncertainOrderId(orderId)
        setDispatchError(`Sifariş #${orderId} üçün göndərmənin nəticəsi bilinmir. Eyni sifarişi təkrar göndərə bilərsiniz; yeni sifariş yaratmayın.`)
        setOrdersRevision((value) => value + 1)
      }
    } finally {
      sendInFlightRef.current = false
      if (mountedRef.current) setSendingOrderId(null)
    }
  }

  // Nəticəsi itən təqdimetmə eyni sifarişə təkrarlanır; yeni sifariş və ödəniş yaratmır.
  async function markServed(orderId: number) {
    if (serveInFlightRef.current || sessionUnavailable || session.error || busy) return
    serveInFlightRef.current = true
    setServingOrderId(orderId)
    setServeError('')
    setServeNotice('')
    try {
      const updated = await ecafeApi.tableSessions.serveOrder(restaurantId, sessionId, orderId)
      if (updated.id !== orderId || updated.statusId !== orderStatusId.served || !updated.servedAt) {
        throw new Error('Təqdimetmə cavabı təsdiqlənmədi.')
      }
      if (!mountedRef.current) return
      setServedOrders((current) => ({ ...current, [orderId]: updated }))
      setUncertainServedId(null)
      setServeNotice(`Sifariş #${orderId} təqdim edildi.`)
      setOrdersRevision((value) => value + 1)
    } catch (error) {
      if (!mountedRef.current) return
      if (error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 404)) {
        setServeAccessDenied(true)
        setUncertainServedId(null)
        setServedOrders({})
        setSelectedOrderId((current) => current === orderId ? null : current)
        setServeError('Bu sifariş və ya masa sessiyası artıq sizə əlçatan deyil.')
        setReloadKey((value) => value + 1)
      } else if (error instanceof ApiError && [400, 409, 422].includes(error.statusCode)) {
        setUncertainServedId(null)
        setServeError(normalizeCaughtApiError(error, 'Sifariş təqdim edildi kimi qeyd oluna bilmədi.').message)
        setOrdersRevision((value) => value + 1)
      } else {
        setUncertainServedId(orderId)
        setServeError(`Sifariş #${orderId} üçün təqdimetmənin nəticəsi bilinmir. Eyni sifarişin nəticəsini yenidən yoxlayın.`)
        setOrdersRevision((value) => value + 1)
      }
    } finally {
      serveInFlightRef.current = false
      if (mountedRef.current) setServingOrderId(null)
    }
  }

  // Nəticəsi bilinməyən POST-u yalnız əvvəlcədən saxlanmış açar və payload ilə təkrarlayır.
  async function sendIntent(intent: PendingOrderIntent) {
    if (inFlightRef.current || sessionUnavailable || session.error) return
    inFlightRef.current = true
    setBusy(true)
    setFeedback('')
    try {
      const order = await ecafeApi.tableSessions.createOrder(restaurantId, sessionId, intent.key, intent.payload)
      if (!Number.isSafeInteger(order.id) || order.id <= 0) throw new Error('Sifariş cavabı təsdiqlənmədi.')
      clearPendingOrderIntent(storageKey)
      if (!mountedRef.current) return
      setPendingIntent(null)
      setKeyConflict(false)
      setPriceConflict(false)
      setCreatedOrder(order)
      setCart([])
      setNote('')
      setSelectedOrderId(order.id)
      setOrdersRevision((value) => value + 1)
    } catch (error) {
      if (!mountedRef.current) return
      if (error instanceof ApiError && (error.code === 'OrderItemPriceChanged' || error.code === 'OrderItemUnavailable')) {
        clearPendingOrderIntent(storageKey)
        setPendingIntent(null)
        setPriceConflict(true)
        setMenuRevision((value) => value + 1)
        setFeedback(error.code === 'OrderItemPriceChanged'
          ? 'Məhsulun qiyməti dəyişib. Yeni qiyməti yoxlayıb təsdiqləyin.'
          : 'Seçilən məhsul artıq əlçatan deyil. Menyunu yoxlayıb səbəti düzəldin.')
      } else if (error instanceof ApiError && error.code === 'OrderRequestKeyConflict') {
        setKeyConflict(true)
        setFeedback('Bu cəhdin açarı başqa məzmunla istifadə olunub. Avtomatik yeni sifariş göndərilməyəcək; menecer ilə yoxlayın.')
      } else if (error instanceof ApiError && error.statusCode === 404) {
        setClosed(true)
        setFeedback('Masa sessiyası artıq açıq deyil. Sifariş göndərilmədi; siyahını yoxlayın.')
      } else if (error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 422)) {
        clearPendingOrderIntent(storageKey)
        setPendingIntent(null)
        setFeedback(normalizeCaughtApiError(error).message)
      } else if (error instanceof ApiError && error.statusCode === 403) {
        setFeedback('Bu masa üçün sifariş icazəniz yoxdur. Restoran və rolunuzu yoxlayın.')
      } else {
        setFeedback('Sifarişin nəticəsi bilinmir. Yeni sifariş yaratmayın; eyni cəhdi təkrar yoxlayın.')
      }
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  // Yeni UUID-ni yalnız yeni, istifadəçi tərəfindən təsdiqlənmiş sifariş üçün yaradır.
  function submitNewOrder() {
    if (!canEdit || inFlightRef.current || !menu.hasData || menu.error) return
    if (!cart.length) { setFeedback('Əvvəl məhsul seçin.'); return }
    if (cart.length > 100 || note.trim().length > 1000 || cart.some((line) =>
      !Number.isSafeInteger(Number(line.item.id)) || line.quantity < 1 || line.quantity > 100 || line.note.trim().length > 500)) {
      setFeedback('Məhsul sayı, miqdar və ya qeyd limitini yoxlayın.')
      return
    }
    const changed = cart.some((line) => {
      const current = menu.data.items.find((item) => item.id === line.item.id && item.isActive)
      return !current || Math.abs(current.price - line.item.price) > 0.001
    })
    if (changed) {
      setPriceConflict(true)
      setFeedback('Menyu dəyişib. Qiymətləri və məhsul əlçatanlığını təsdiqləyin.')
      return
    }
    const intent = { key: crypto.randomUUID(), payload: JSON.stringify(buildOrderBody(cart, note)), createdAt: Date.now() }
    try { savePendingOrderIntent(storageKey, intent) }
    catch { setFeedback('Sifariş cəhdi təhlükəsiz saxlanmadı. Brauzer yaddaşını yoxlayın.'); return }
    setCreatedOrder(null)
    setPendingIntent(intent)
    void sendIntent(intent)
  }

  // Yeni qiyməti qəbul etmək ayrıca istifadəçi hərəkətidir; çatışmayan məhsul səbətdə qalır.
  function acceptCurrentPrices() {
    if (!menu.hasData || menu.isRefreshing || menu.error) return
    setCart((current) => current.map((line) => {
      const latest = menu.data.items.find((item) => item.id === line.item.id && item.isActive)
      return latest ? { ...line, item: latest } : line
    }))
    setPriceConflict(false)
    setFeedback('Qiymətlər yeniləndi. Əlçatan olmayan məhsulları səbətdən çıxarın və sifarişi yenidən təsdiqləyin.')
  }

  function addItem(item: MenuItem) {
    if (!canEdit) return
    const existing = cart.find((line) => line.item.id === item.id)
    if ((existing?.quantity ?? 0) >= 100 || (!existing && cart.length >= 100)) {
      setFeedback('Məhsul və ya miqdar limiti dolub.')
      return
    }
    setCart((current) => existing
      ? current.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { item, quantity: 1, note: '' }])
    setFeedback('')
  }

  function changeQuantity(itemId: string, delta: number) {
    if (!canEdit) return
    setCart((current) => current.map((line) => line.item.id === itemId
      ? { ...line, quantity: Math.min(100, line.quantity + delta) } : line).filter((line) => line.quantity > 0))
  }

  return <main className="staff-page waiter-orders-page">
    <header className="waiter-orders-heading">
      <ButtonLink to="/waiter?view=tables" variant="ghost" className="waiter-orders-back"><ArrowLeft size={17} />{i18n.t('ui.pages.staff.waiter_session_orders_page.aciq_masalar_94a704')}</ButtonLink>
      <div><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.masa_sifarisleri_8cfcea')}</span><h1>{session.data ? `${session.data.tableName || `Masa-${session.data.tableNo}`} sifarişləri` :i18n.t('ui.pages.staff.waiter_session_orders_page.masa_sifarisleri_a21dba')}</h1></div>
    </header>
    {session.isLoading ? <p role="status">{i18n.t('ui.pages.staff.waiter_session_orders_page.masa_sessiyasi_yuklenir_48c96c')}</p> : null}
    {session.error ? <StatusMessage tone="danger" autoHideMs={false}>{session.error}</StatusMessage> : null}
    {sessionUnavailable ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_session_orders_page.bu_masa_sessiyasi_size_aid_deyil_ve_ya_88d546')}{pendingIntent ?i18n.t('ui.pages.staff.waiter_session_orders_page.evvelki_cehdin_neticesini_menecer_ile__5b1cad') : ''}</StatusMessage> : null}
    {sessionUnavailable && orders.error ? <StatusMessage tone="danger" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_siyahisi_yenilenmedi_085ed1')} {orders.error}</StatusMessage> : null}
    {sessionUnavailable && detail.error ? <StatusMessage tone="danger" autoHideMs={false}>{detail.error}</StatusMessage> : null}
    {sessionUnavailable && menu.error ? <StatusMessage tone="danger" autoHideMs={false}>{menu.error}</StatusMessage> : null}
    {session.data && !sessionUnavailable ? <div className="waiter-orders-session"><span><Table2 size={17} aria-hidden="true" /><strong>{session.data.tableName || `Masa-${session.data.tableNo}`}</strong></span><span>{session.data.customerName || 'Ad qeyd olunmayıb'}</span><span><UsersRound size={16} aria-hidden="true" />{session.data.peopleCount == null ?i18n.t('ui.pages.staff.waiter_session_orders_page.qonaq_sayi_qeyd_olunmayib_98c6e4') : `${session.data.peopleCount} nəfər`}</span></div> : null}
    {session.data && !sessionUnavailable ? <SessionBillPanel sessionId={sessionId} revision={ordersRevision} onBillChange={setBill} /> : null}
    {billPaymentPending ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_session_orders_page.odenis_gozlemededir_yeni_sifaris_ucun__fe73dd')}</StatusMessage> : null}
    {createdOrder ? <StatusMessage tone="success" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_96cfd8')}{createdOrder.id} {i18n.t('ui.pages.staff.waiter_session_orders_page.yaradildi_mehsul_cemi_3ed07a')} {money(createdOrder.subtotal)}{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_metbexe_gonderilmeyib_e3d65a')}</StatusMessage> : null}
    {dispatchNotice ? <StatusMessage tone="success" autoHideMs={false}>{dispatchNotice}</StatusMessage> : null}
    {dispatchError ? <StatusMessage tone={uncertainOrderId !== null ? 'warning' : 'danger'} autoHideMs={false}>{dispatchError}</StatusMessage> : null}
    {serveNotice ? <StatusMessage tone="success" autoHideMs={false}>{serveNotice}</StatusMessage> : null}
    {serveError ? <StatusMessage tone={uncertainServedId !== null ? 'warning' : 'danger'} autoHideMs={false}>{serveError}</StatusMessage> : null}
    {feedback && !sessionUnavailable ? <StatusMessage tone={pendingIntent || priceConflict || keyConflict ? 'warning' : 'danger'} autoHideMs={false}>{feedback}</StatusMessage> : null}
    {pendingIntent && !sessionUnavailable ? <div className="waiter-order-pending">
      <div><strong>{i18n.t('ui.pages.staff.waiter_session_orders_page.neticesi_bilinmeyen_cehd_8d8644')}</strong><p>{i18n.t('ui.pages.staff.waiter_session_orders_page.bu_cehd_avtomatik_tekrarlanmir_tekrar__7f930a')}</p>
        {pendingBody ? <ul>{pendingBody.items.map((line) => <li key={line.itemId}>{menu.data.items.find((item) => Number(item.id) === line.itemId)?.name || `Məhsul #${line.itemId}`} · {i18n.t('ui.count.items', { count: line.quantity })} · {money(line.expectedUnitPrice)}{line.note ? ` · ${line.note}` : ''}</li>)}</ul> : null}
        {pendingBody?.note ? <p>{i18n.t('ui.pages.staff.waiter_session_orders_page.umumi_qeyd_bf8c91')} {pendingBody.note}</p> : null}
      </div>
      <Button type="button" disabled={busy || keyConflict || Boolean(session.error)} onClick={() => void sendIntent(pendingIntent)}><RefreshCw size={17} />{i18n.t('ui.pages.staff.waiter_session_orders_page.eyni_cehdi_yoxla_668041')}</Button>
    </div> : null}
    {priceConflict && !pendingIntent ? <div className="waiter-order-price-review"><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.qiymet_ve_elcatanligi_yeniden_yoxlayin_357c7b')}</span><Button type="button" variant="secondary" disabled={!menu.hasData || menu.isRefreshing || Boolean(menu.error)} onClick={acceptCurrentPrices}>{i18n.t('ui.pages.staff.waiter_session_orders_page.yeni_qiymetleri_qebul_et_c0371c')}</Button></div> : null}
    {!sessionUnavailable && !session.error ? <div className="waiter-orders-compose">
      <section className="waiter-orders-menu" aria-label={i18n.t('ui.pages.staff.waiter_session_orders_page.restoran_menyusu_6b012b')}>
        <div className="waiter-orders-section-heading"><h2>{i18n.t('ui.pages.staff.waiter_session_orders_page.menyu_da3241')}</h2><Button type="button" variant="secondary" title={i18n.t('ui.pages.staff.waiter_session_orders_page.menyunu_yenile_a50a44')} aria-label={i18n.t('ui.pages.staff.waiter_session_orders_page.menyunu_yenile_a50a44')} onClick={() => setMenuRevision((value) => value + 1)}><RefreshCw size={17} /></Button></div>
        <div className="waiter-orders-menu-filters"><label>{i18n.t('ui.pages.staff.waiter_session_orders_page.mehsul_axtar_b645b4')}<span className="waiter-orders-search"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={i18n.t('ui.pages.staff.waiter_session_orders_page.mehsul_adi_24606f')} /></span></label><label>{i18n.t('ui.pages.staff.waiter_session_orders_page.kateqoriya_2812c5')}<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">{i18n.t('ui.pages.staff.waiter_session_orders_page.hamisi_fba8f8')}</option>{menu.data.categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        {menu.isLoading ? <p role="status">{i18n.t('ui.pages.staff.waiter_session_orders_page.menyu_yuklenir_b8bb64')}</p> : null}
        {menu.error ? <StatusMessage tone="danger" autoHideMs={false}>{menu.error}</StatusMessage> : null}
        {menu.hasData && !menu.error && visibleItems.length === 0 ? <p className="waiter-orders-muted">{i18n.t('ui.pages.staff.waiter_session_orders_page.uygun_mehsul_tapilmadi_5efc83')}</p> : null}
        <div className="waiter-orders-menu-list">{visibleItems.map((item) => <div className="waiter-orders-menu-item" key={item.id}><div><strong>{item.name}</strong><span>{item.categoryName || 'Menyu'}</span></div><strong>{money(item.price)}</strong><Button type="button" variant="secondary" disabled={!canEdit} onClick={() => addItem(item)} title={`${item.name} əlavə et`} aria-label={`${item.name} əlavə et`}><Plus size={17} /></Button></div>)}</div>
      </section>
      <section className="waiter-orders-cart" aria-label={i18n.t('ui.pages.staff.waiter_session_orders_page.yeni_sifaris_aac4a7')}>
        <div className="waiter-orders-section-heading"><div><h2>{i18n.t('ui.pages.staff.waiter_session_orders_page.yeni_sifaris_aac4a7')}</h2><span>{i18n.t('ui.count.items', { count: itemCount })}</span></div><ShoppingBasket size={18} aria-hidden="true" /></div>
        {cart.length === 0 ? <p className="waiter-orders-muted">{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_ucun_menyudan_mehsul_elave_edi_a35435')}</p> : <div className="waiter-orders-cart-lines">{cart.map((line) => <div className="waiter-orders-cart-line" key={line.item.id}>
          <div className="waiter-orders-cart-line-main"><strong>{line.item.name}</strong><div className="waiter-orders-stepper"><button type="button" disabled={!canEdit} aria-label={`${line.item.name} azalt`} onClick={() => changeQuantity(line.item.id, -1)}><Minus size={15} /></button><span>{line.quantity}</span><button type="button" disabled={!canEdit || line.quantity >= 100} aria-label={`${line.item.name} artır`} onClick={() => changeQuantity(line.item.id, 1)}><Plus size={15} /></button></div><strong className="waiter-orders-line-total">{money(line.item.price * line.quantity)}</strong><button className="waiter-orders-remove" type="button" disabled={!canEdit} title={i18n.t('ui.pages.staff.waiter_session_orders_page.mehsulu_sil_04b540')} aria-label={`${line.item.name} sil`} onClick={() => setCart((current) => current.filter((item) => item.item.id !== line.item.id))}><Trash2 size={16} /></button></div>
          <details className="waiter-orders-note"><summary>{line.note ? `Qeyd: ${line.note}` :i18n.t('ui.pages.staff.waiter_session_orders_page.qeyd_elave_et_6e801f')}</summary><label>{i18n.t('ui.pages.staff.waiter_session_orders_page.mehsul_qeydi_f3bc85')}<input value={line.note} maxLength={500} disabled={!canEdit} onChange={(event) => setCart((current) => current.map((item) => item.item.id === line.item.id ? { ...item, note: event.target.value } : item))} placeholder={i18n.t('ui.pages.staff.waiter_session_orders_page.isteye_bagli_1d54da')} /></label></details>
        </div>)}</div>}
        <details className="waiter-orders-note waiter-orders-general-note"><summary>{note ? `Sifariş qeydi: ${note}` :i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_qeydi_elave_et_ce38df')}</summary><label>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_qeydi_0fdc39')}<textarea value={note} maxLength={1000} disabled={!canEdit} onChange={(event) => setNote(event.target.value)} rows={3} placeholder={i18n.t('ui.pages.staff.waiter_session_orders_page.isteye_bagli_1d54da')} /></label></details>
        <div className="waiter-orders-cart-footer"><div><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.mehsul_cemi_82c1ba')}</span><strong>{money(subtotal)}</strong></div><Button type="button" disabled={!canEdit || !cart.length || !menu.hasData || Boolean(menu.error)} onClick={submitNewOrder}>{busy ?i18n.t('ui.pages.staff.waiter_session_orders_page.gonderilir_e1bb27') :i18n.t('ui.pages.staff.waiter_session_orders_page.sifarisi_yarat_4c2250')}</Button></div>
      </section>
    </div> : null}
    {!sessionUnavailable ? <section className="waiter-orders-history" aria-label={i18n.t('ui.pages.staff.waiter_session_orders_page.masa_sifarisleri_a21dba')}>
      <div className="waiter-orders-section-heading"><div><h2>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifarisler_0b5f10')}</h2><span>{orderPage ? `${orderPage.totalCount} sifariş` : ''}</span></div><Button type="button" variant="secondary" title={i18n.t('ui.pages.staff.waiter_session_orders_page.sifarisleri_yenile_870c48')} aria-label={i18n.t('ui.pages.staff.waiter_session_orders_page.sifarisleri_yenile_870c48')} onClick={() => setOrdersRevision((value) => value + 1)}><RefreshCw size={17} /></Button></div>
      {orders.isLoading ? <p role="status">{i18n.t('ui.pages.staff.waiter_session_orders_page.sifarisler_yuklenir_917624')}</p> : null}
      {orders.error ? <StatusMessage tone="danger" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_siyahisi_yenilenmedi_085ed1')} {orders.error}</StatusMessage> : null}
      {orderPage && orderPage.items.length === 0 ? <p className="waiter-orders-muted">{i18n.t('ui.pages.staff.waiter_session_orders_page.bu_masa_ucun_sifaris_yoxdur_67bbfa')}</p> : null}
      {orderPage && orderPage.items.length > 0 ? <div className="waiter-orders-history-list"><div className="waiter-orders-history-columns" aria-hidden="true"><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_23da3b')}</span><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.yaradilib_526f2e')}</span><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.miqdar_77c299')}</span><span>{i18n.t('ui.pages.staff.waiter_session_orders_page.mebleg_3d95ed')}</span></div>{orderPage.items.map((record) => {
        const order = servedOrders[record.id] && !record.servedAt && record.statusId === orderStatusId.ready ? servedOrders[record.id] : record
        return <button type="button" className={selectedOrderId === order.id ? 'is-selected' : ''} key={order.id} onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}><span className="waiter-order-history-id"><strong>{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_96cfd8')}{order.id}</strong><small>{orderKitchenLabel(order.statusId, sentOrderTimes[order.id] || order.sentToKitchenAt)}</small></span><span>{formatReservationDateTime(order.openedAt, session.data?.timeZone)}</span><span>{i18n.t('ui.count.items', { count: order.items.reduce((sum, line) => sum + line.quantity, 0) })}</span><strong>{money(order.subtotal)}</strong></button>
      })}</div> : null}
      {orderPage ? <PaginationControls ariaLabel={i18n.t('ui.pages.staff.waiter_session_orders_page.masa_sifarisi_sehifeleri_5776fb')} pageIndex={orderPage.pageIndex} totalPages={orderPage.totalPages} totalCount={orderPage.totalCount} pageSize={20} hasPreviousPage={orderPage.hasPreviousPage} hasNextPage={orderPage.hasNextPage} onPageChange={(next) => { setPage(next); setSelectedOrderId(null) }} /> : null}
      {selectedOrderId !== null ? <div className="waiter-orders-detail" aria-label={i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detali_f143a4')}>{detail.isLoading ? <p role="status">{i18n.t('ui.pages.staff.waiter_session_orders_page.sifaris_detali_yuklenir_d98e58')}</p> : null}{detail.error ? <StatusMessage tone="danger" autoHideMs={false}>{detail.error}</StatusMessage> : null}{selectedOrder ? <OrderSummary order={selectedOrder} timeZone={session.data?.timeZone} onClose={() => setSelectedOrderId(null)} onSend={() => void sendToKitchen(selectedOrder.id)} onServe={() => void markServed(selectedOrder.id)} sending={sendingOrderId === selectedOrder.id} serving={servingOrderId === selectedOrder.id} canSend={!busy && !sessionUnavailable && Boolean(session.data) && !session.error} canServe={!busy && !sessionUnavailable && Boolean(session.data) && !session.error} retrying={uncertainOrderId === selectedOrder.id} retryingServe={uncertainServedId === selectedOrder.id} /> : null}</div> : null}
    </section> : null}
  </main>
}
