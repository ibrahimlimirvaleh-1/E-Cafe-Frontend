import { ArrowLeft, Minus, Plus, RefreshCw, ShoppingBasket, Table2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { MenuItem } from '../../entities/types'
import { clearPendingOrderIntent, pendingOrderStorageKey, readPendingOrderIntent, savePendingOrderIntent, type PendingOrderIntent } from '../../features/orders/pendingOrderIntent'
import { ecafeApi, type CreateSessionOrderRequest, type SessionOrderResponse, type WaiterTableSessionResponse } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAuth } from '../../shared/auth/AuthContext'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
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

function OrderSummary({ order, title, timeZone }: { order: SessionOrderResponse; title: string; timeZone?: string }) {
  return <div className="waiter-order-summary">
    <div className="waiter-order-summary-heading"><div><span>SİFARİŞ #{order.id}</span><h3>{title}</h3></div><strong>{money(order.subtotal)}</strong></div>
    <p>{formatReservationDateTime(order.openedAt, timeZone)} · {order.sentToKitchenAt ? 'Mətbəxə göndərilib' : 'Mətbəxə göndərilməyib'}</p>
    <ul>{order.items.map((line) => <li key={line.id}><span><strong>{line.quantity} × {line.name}</strong>{line.note ? <small>{line.note}</small> : null}</span><strong>{money(line.lineTotal)}</strong></li>)}</ul>
    {order.note ? <p className="waiter-order-note">Qeyd: {order.note}</p> : null}
  </div>
}

export function WaiterSessionOrdersPage() {
  const { user } = useAuth()
  const { restaurantId = '', sessionId = '' } = useParams()
  const parsedSessionId = Number(sessionId)

  if (!user || user.restaurantId !== restaurantId || !Number.isSafeInteger(parsedSessionId) || parsedSessionId <= 0) {
    return <Navigate to="/waiter?view=tables" replace />
  }

  return <SessionOrderWorkspace key={`${user.userId}:${restaurantId}:${parsedSessionId}`} userId={user.userId} restaurantId={restaurantId} sessionId={parsedSessionId} />
}

function SessionOrderWorkspace({ userId, restaurantId, sessionId }: { userId: string; restaurantId: string; sessionId: number }) {
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
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [createdOrder, setCreatedOrder] = useState<SessionOrderResponse | null>(null)
  const [feedback, setFeedback] = useState(pendingIntent ? 'Əvvəlki sifariş cəhdinin nəticəsi bilinmir. Eyni cəhdi yenidən yoxlayın.' : '')
  const [priceConflict, setPriceConflict] = useState(false)
  const [keyConflict, setKeyConflict] = useState(false)
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const scopeKey = `${restaurantId}:${sessionId}`

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
  const orders = useKeyedAsyncData(
    () => ecafeApi.tableSessions.listOrders(restaurantId, sessionId, page),
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
    if (orders.hasData && page > orders.data.totalPages) {
      setPage(Math.max(1, orders.data.totalPages))
      setSelectedOrderId(null)
    }
  }, [orders.data.totalPages, orders.hasData, page])

  const sessionUnavailable = closed || (session.hasData && !session.data)
  const canEdit = Boolean(session.hasData && session.data && !session.error && !pendingIntent && !busy && !closed)
  const visibleItems = useMemo(() => menu.hasData && !menu.error
    ? menu.data.items.filter((item) => item.isActive && (categoryId === 'all' || item.categoryId === categoryId) &&
      item.name.toLocaleLowerCase('az').includes(search.trim().toLocaleLowerCase('az')))
    : [], [menu.hasData, menu.error, menu.data.items, categoryId, search])
  const subtotal = cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0)
  const selectedOrder = detail.hasData && detail.data?.kind === 'found' && !detail.error ? detail.data.order : null
  const pendingBody = pendingIntent ? JSON.parse(pendingIntent.payload) as CreateSessionOrderRequest : null

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
    <ButtonLink to="/waiter?view=tables" variant="ghost" className="waiter-orders-back"><ArrowLeft size={17} />Açıq masalara qayıt</ButtonLink>
    <PageHeader eyebrow="MASA SİFARİŞLƏRİ" title={session.data ? `${session.data.tableName || `Masa-${session.data.tableNo}`} sifarişləri` : 'Masa sifarişləri'} description="Məhsul seçin və bu açıq masa üçün sifariş yaradın." />
    {session.isLoading ? <p role="status">Masa sessiyası yüklənir...</p> : null}
    {session.error ? <StatusMessage tone="danger" autoHideMs={false}>{session.error}</StatusMessage> : null}
    {sessionUnavailable ? <StatusMessage tone="warning" autoHideMs={false}>Bu masa sessiyası artıq açıq deyil. Yeni sifariş göndərmək mümkün deyil.{pendingIntent ? ' Əvvəlki cəhdin nəticəsini menecer ilə yoxlayın.' : ''}</StatusMessage> : null}
    {session.data && !sessionUnavailable ? <div className="waiter-orders-session"><Table2 size={18} aria-hidden="true" /><strong>{session.data.tableName || `Masa-${session.data.tableNo}`}</strong><span>{session.data.customerName || 'Ad qeyd olunmayıb'}</span><span>{session.data.peopleCount == null ? 'Qonaq sayı qeyd olunmayıb' : `${session.data.peopleCount} nəfər`}</span></div> : null}
    {createdOrder ? <StatusMessage tone="success" autoHideMs={false}>Sifariş #{createdOrder.id} yaradıldı. Məhsul cəmi {money(createdOrder.subtotal)}. Sifariş mətbəxə göndərilməyib.</StatusMessage> : null}
    {feedback && !sessionUnavailable ? <StatusMessage tone={pendingIntent || priceConflict || keyConflict ? 'warning' : 'danger'} autoHideMs={false}>{feedback}</StatusMessage> : null}
    {pendingIntent && !sessionUnavailable ? <div className="waiter-order-pending">
      <div><strong>Nəticəsi bilinməyən cəhd</strong><p>Bu cəhd avtomatik təkrarlanmır. Təkrar yoxlama eyni açar və dəyişməz sifariş məzmunu ilə aparılır.</p>
        {pendingBody ? <ul>{pendingBody.items.map((line) => <li key={line.itemId}>{menu.data.items.find((item) => Number(item.id) === line.itemId)?.name || `Məhsul #${line.itemId}`} · {line.quantity} ədəd · {money(line.expectedUnitPrice)}{line.note ? ` · ${line.note}` : ''}</li>)}</ul> : null}
        {pendingBody?.note ? <p>Ümumi qeyd: {pendingBody.note}</p> : null}
      </div>
      <Button type="button" disabled={busy || keyConflict || Boolean(session.error)} onClick={() => void sendIntent(pendingIntent)}><RefreshCw size={17} />Eyni cəhdi yoxla</Button>
    </div> : null}
    {priceConflict && !pendingIntent ? <div className="waiter-order-price-review"><span>Qiymət və əlçatanlığı yenidən yoxlayın.</span><Button type="button" variant="secondary" disabled={!menu.hasData || menu.isRefreshing || Boolean(menu.error)} onClick={acceptCurrentPrices}>Yeni qiymətləri qəbul et</Button></div> : null}
    {!sessionUnavailable && !session.error ? <div className="waiter-orders-compose">
      <section className="waiter-orders-menu" aria-label="Restoran menyusu">
        <div className="waiter-orders-section-heading"><h2>Menyu</h2><Button type="button" variant="secondary" title="Menyunu yenilə" aria-label="Menyunu yenilə" onClick={() => setMenuRevision((value) => value + 1)}><RefreshCw size={17} /></Button></div>
        <div className="waiter-orders-menu-filters"><label>Məhsul axtar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Məhsul adı" /></label><label>Kateqoriya<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Hamısı</option>{menu.data.categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        {menu.isLoading ? <p role="status">Menyu yüklənir...</p> : null}
        {menu.error ? <StatusMessage tone="danger" autoHideMs={false}>{menu.error}</StatusMessage> : null}
        {menu.hasData && !menu.error && visibleItems.length === 0 ? <p className="waiter-orders-muted">Uyğun məhsul tapılmadı.</p> : null}
        <div className="waiter-orders-menu-list">{visibleItems.map((item) => <div className="waiter-orders-menu-item" key={item.id}><div><strong>{item.name}</strong><span>{item.categoryName || 'Menyu'}</span></div><strong>{money(item.price)}</strong><Button type="button" variant="secondary" disabled={!canEdit} onClick={() => addItem(item)} aria-label={`${item.name} əlavə et`}><Plus size={17} /></Button></div>)}</div>
      </section>
      <section className="waiter-orders-cart" aria-label="Yeni sifariş">
        <div className="waiter-orders-section-heading"><h2>Yeni sifariş</h2><ShoppingBasket size={19} aria-hidden="true" /></div>
        {cart.length === 0 ? <p className="waiter-orders-muted">Sifariş üçün menyudan məhsul əlavə edin.</p> : <div className="waiter-orders-cart-lines">{cart.map((line) => <div className="waiter-orders-cart-line" key={line.item.id}>
          <div className="waiter-orders-cart-line-title"><strong>{line.item.name}</strong><button type="button" disabled={!canEdit} title="Məhsulu sil" aria-label={`${line.item.name} sil`} onClick={() => setCart((current) => current.filter((item) => item.item.id !== line.item.id))}><Trash2 size={16} /></button></div>
          <div className="waiter-orders-cart-line-controls"><div className="waiter-orders-stepper"><button type="button" disabled={!canEdit} aria-label={`${line.item.name} azalt`} onClick={() => changeQuantity(line.item.id, -1)}><Minus size={15} /></button><span>{line.quantity}</span><button type="button" disabled={!canEdit || line.quantity >= 100} aria-label={`${line.item.name} artır`} onClick={() => changeQuantity(line.item.id, 1)}><Plus size={15} /></button></div><strong>{money(line.item.price * line.quantity)}</strong></div>
          <label>Məhsul qeydi<input value={line.note} maxLength={500} disabled={!canEdit} onChange={(event) => setCart((current) => current.map((item) => item.item.id === line.item.id ? { ...item, note: event.target.value } : item))} placeholder="İstəyə bağlı" /></label>
        </div>)}</div>}
        <label className="waiter-orders-general-note">Sifariş qeydi<textarea value={note} maxLength={1000} disabled={!canEdit} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="İstəyə bağlı" /></label>
        <div className="waiter-orders-cart-footer"><div><span>Məhsul cəmi</span><strong>{money(subtotal)}</strong></div><Button type="button" disabled={!canEdit || !cart.length || !menu.hasData || Boolean(menu.error)} onClick={submitNewOrder}>{busy ? 'Göndərilir...' : 'Sifarişi yarat'}</Button></div>
      </section>
    </div> : null}
    <section className="waiter-orders-history" aria-label="Masa sifarişləri">
      <div className="waiter-orders-section-heading"><div><h2>Sifarişlər</h2><span>{orders.hasData && !orders.error ? `${orders.data.totalCount} sifariş` : ''}</span></div><Button type="button" variant="secondary" title="Sifarişləri yenilə" aria-label="Sifarişləri yenilə" onClick={() => setOrdersRevision((value) => value + 1)}><RefreshCw size={17} /></Button></div>
      {orders.isLoading ? <p role="status">Sifarişlər yüklənir...</p> : null}
      {orders.error ? <StatusMessage tone="danger" autoHideMs={false}>Sifariş siyahısı yenilənmədi: {orders.error}</StatusMessage> : null}
      {orders.hasData && !orders.error && orders.data.items.length === 0 ? <p className="waiter-orders-muted">Bu masa üçün sifariş yoxdur.</p> : null}
      {orders.hasData && !orders.error ? <div className="waiter-orders-history-list">{orders.data.items.map((order) => <button type="button" className={selectedOrderId === order.id ? 'is-selected' : ''} key={order.id} onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}><span><strong>Sifariş #{order.id}</strong><small>{formatReservationDateTime(order.openedAt, session.data?.timeZone)} · {order.items.length} məhsul</small></span><strong>{money(order.subtotal)}</strong></button>)}</div> : null}
      {orders.hasData && !orders.error ? <PaginationControls ariaLabel="Masa sifarişi səhifələri" pageIndex={orders.data.pageIndex} totalPages={orders.data.totalPages} totalCount={orders.data.totalCount} pageSize={20} hasPreviousPage={orders.data.hasPreviousPage} hasNextPage={orders.data.hasNextPage} onPageChange={(next) => { setPage(next); setSelectedOrderId(null) }} /> : null}
      {selectedOrderId !== null ? <div className="waiter-orders-detail" aria-label="Sifariş detalı">{detail.isLoading ? <p role="status">Sifariş detalı yüklənir...</p> : null}{detail.error ? <StatusMessage tone="danger" autoHideMs={false}>{detail.error}</StatusMessage> : null}{selectedOrder ? <OrderSummary order={selectedOrder} title="Sifariş detalı" timeZone={session.data?.timeZone} /> : null}</div> : null}
    </section>
  </main>
}
