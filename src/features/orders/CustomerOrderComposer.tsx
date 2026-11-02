import { Minus, Plus, RefreshCw, Search, ShoppingBasket, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MenuItem } from '../../entities/types'
import { ecafeApi, type CreateSessionOrderRequest, type CustomerTableSessionResponse } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { i18n } from '../../shared/i18n/i18n'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { buildOrderBody, validateOrderCart } from './orderCart'
import { clearPendingOrderIntent, customerOrderIntentKey, readPendingOrderIntent, savePendingOrderIntent, type PendingOrderIntent } from './pendingOrderIntent'
import { clearWaiterOrderDraft, customerOrderDraftKey, readWaiterOrderDraft, saveWaiterOrderDraft, type WaiterDraftLine } from './waiterOrderDraft'
import './customer-order-composer.css'

type Props = {
  session: CustomerTableSessionResponse
  userId: string
  disabled: boolean
  onCreated: (orderId: number) => void
  onRefresh: () => void
}

function money(amount: number) {
  return `${amount.toFixed(2)} AZN`
}

export function CustomerOrderComposer({ session, userId, disabled, onCreated, onRefresh }: Props) {
  const restaurantId = String(session.restaurantId)
  const intentKey = customerOrderIntentKey(userId, restaurantId, session.id)
  const draftKey = customerOrderDraftKey(userId, restaurantId, session.id)
  const [initialDraft] = useState(() => readWaiterOrderDraft(draftKey))
  const [pendingIntent, setPendingIntent] = useState<PendingOrderIntent | null>(() => readPendingOrderIntent(intentKey))
  const [open, setOpen] = useState(Boolean(pendingIntent))
  const [cart, setCart] = useState<WaiterDraftLine[]>(initialDraft.cart)
  const [note, setNote] = useState(initialDraft.note)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [menuRevision, setMenuRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [priceConflict, setPriceConflict] = useState(false)
  const [keyConflict, setKeyConflict] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [success, setSuccess] = useState('')
  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const menu = useKeyedAsyncData(
    () => open && session.canCreateOrder ? ecafeApi.menu.publicMenuStrict(restaurantId) : Promise.resolve({ categories: [], items: [] }),
    { categories: [], items: [] } as Awaited<ReturnType<typeof ecafeApi.menu.publicMenuStrict>>,
    `${userId}:${session.id}:${open}`, [menuRevision, session.canCreateOrder],
  )
  const canEdit = open && session.canCreateOrder && !disabled && !busy && !pendingIntent && menu.hasData && !menu.error
  const visibleItems = useMemo(() => menu.hasData && !menu.error
    ? menu.data.items.filter((item) => item.isActive && (categoryId === 'all' || item.categoryId === categoryId) &&
      item.name.toLocaleLowerCase(i18n.language).includes(search.trim().toLocaleLowerCase(i18n.language)))
    : [], [menu.data.items, menu.hasData, menu.error, categoryId, search])
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const subtotal = cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0)
  const unavailableIds = menu.hasData && !menu.error
    ? new Set(cart.filter((line) => !menu.data.items.some((item) => item.id === line.item.id && item.isActive)).map((line) => line.item.id))
    : new Set<string>()
  const pendingBody = pendingIntent ? JSON.parse(pendingIntent.payload) as CreateSessionOrderRequest : null

  useEffect(() => {
    try { saveWaiterOrderDraft(draftKey, { cart, note }) }
    catch { setFeedback(i18n.t('ui.customerOrder.draftUnavailable')) }
  }, [draftKey, cart, note])

  async function sendIntent(intent: PendingOrderIntent) {
    if (inFlightRef.current || disabled) return
    inFlightRef.current = true
    setBusy(true)
    setFeedback('')
    try {
      const order = await ecafeApi.customerTableSessions.createOrder(session.id, intent.key, intent.payload)
      if (!Number.isSafeInteger(order.id) || order.id <= 0 || order.tableSessionId !== session.id) throw new Error('Invalid order response')
      try { clearPendingOrderIntent(intentKey); clearWaiterOrderDraft(draftKey) } catch { /* Server confirmed the order. */ }
      if (!mountedRef.current) return
      setPendingIntent(null)
      setKeyConflict(false)
      setPriceConflict(false)
      setCart([])
      setNote('')
      setOpen(false)
      setSuccess(i18n.t('ui.customerOrder.created', { id: order.id }))
      onCreated(order.id)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (error) {
      if (!mountedRef.current) return
      if (error instanceof ApiError && (error.code === 'OrderItemPriceChanged' || error.code === 'OrderItemUnavailable')) {
        try { clearPendingOrderIntent(intentKey) } catch { /* The stale intent is not retried. */ }
        setPendingIntent(null)
        setPriceConflict(true)
        setMenuRevision((value) => value + 1)
        setFeedback(i18n.t(error.code === 'OrderItemPriceChanged' ? 'ui.customerOrder.priceChanged' : 'ui.customerOrder.itemUnavailable'))
      } else if (error instanceof ApiError && error.code === 'OrderRequestKeyConflict') {
        setKeyConflict(true)
        setFeedback(i18n.t('ui.customerOrder.keyConflict'))
      } else if (error instanceof ApiError && [400, 403, 404, 409, 422].includes(error.statusCode)) {
        try { clearPendingOrderIntent(intentKey) } catch { /* The server rejected the attempt. */ }
        setPendingIntent(null)
        setFeedback(error.statusCode === 403 ? i18n.t('ui.customerOrder.forbidden')
          : error.statusCode === 404 || error.statusCode === 409 ? i18n.t('ui.customerOrder.sessionUnavailable')
            : normalizeCaughtApiError(error, i18n.t('ui.customerOrder.invalid')).message)
        onRefresh()
      } else {
        setFeedback(i18n.t('ui.customerOrder.uncertain'))
      }
    } finally {
      inFlightRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  function submit() {
    if (!canEdit || inFlightRef.current || priceConflict) return
    const invalid = validateOrderCart(cart, note)
    if (invalid) { setFeedback(i18n.t(invalid === 'empty' ? 'ui.customerOrder.chooseItem' : 'ui.customerOrder.invalid')); return }
    const changed = cart.some((line) => {
      const latest = menu.data.items.find((item) => item.id === line.item.id && item.isActive)
      return !latest || Math.abs(latest.price - line.item.price) > 0.001
    })
    if (changed) { setPriceConflict(true); setFeedback(i18n.t('ui.customerOrder.menuChanged')); setMenuRevision((value) => value + 1); return }
    const intent = { key: crypto.randomUUID(), payload: JSON.stringify(buildOrderBody(cart, note)), createdAt: Date.now() }
    try { savePendingOrderIntent(intentKey, intent) }
    catch { setFeedback(i18n.t('ui.customerOrder.intentUnavailable')); return }
    setPendingIntent(intent)
    void sendIntent(intent)
  }

  function addItem(item: MenuItem) {
    if (!canEdit) return
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id)
      if ((existing?.quantity ?? 0) >= 100 || (!existing && current.length >= 100)) return current
      return existing ? current.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { item, quantity: 1, note: '' }]
    })
    setFeedback('')
  }

  function changeQuantity(itemId: string, delta: number) {
    if (!canEdit) return
    setCart((current) => current.map((line) => line.item.id === itemId
      ? { ...line, quantity: Math.min(100, line.quantity + delta) } : line).filter((line) => line.quantity > 0))
  }

  function acceptPrices() {
    if (!menu.hasData || menu.isRefreshing || menu.error) return
    if (unavailableIds.size > 0) {
      setFeedback(i18n.t('ui.customerOrder.removeUnavailable'))
      return
    }
    setCart((current) => current.map((line) => {
      const latest = menu.data.items.find((item) => item.id === line.item.id && item.isActive)!
      return { ...line, item: latest }
    }))
    setPriceConflict(false)
    setFeedback(i18n.t('ui.customerOrder.pricesAccepted'))
  }

  if (!session.canCreateOrder && !pendingIntent && !open) return null

  return <section className="customer-order-compose" aria-label={i18n.t('ui.customerOrder.new')}>
    <div className="customer-order-compose-heading">
      <div><span className="customer-orders-kicker">{i18n.t('ui.customerOrder.menu')}</span><h3>{i18n.t('ui.customerOrder.new')}</h3></div>
      {session.canCreateOrder ? <Button type="button" variant={open ? 'secondary' : 'primary'} disabled={busy} onClick={() => { setOpen((value) => !value); setFeedback('') }}>
        {open ? <X size={17} /> : <Plus size={17} />}{open ? i18n.t('ui.customerOrder.close') : i18n.t('ui.customerOrder.new')}
      </Button> : null}
    </div>
    {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}
    {open && !session.canCreateOrder ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.customerOrder.notAvailable')}</StatusMessage> : null}
    {feedback ? <StatusMessage tone={pendingIntent || priceConflict || keyConflict ? 'warning' : 'danger'} autoHideMs={false}>{feedback}</StatusMessage> : null}
    {open && pendingIntent ? <div className="customer-order-pending">
      <div><strong>{i18n.t('ui.customerOrder.pendingAttempt')}</strong><p>{i18n.t('ui.customerOrder.uncertain')}</p>
        <ul>{pendingBody?.items.map((line) => <li key={line.itemId}>{cart.find((item) => Number(item.item.id) === line.itemId)?.item.name || `#${line.itemId}`} · {line.quantity} × {money(line.expectedUnitPrice)}</li>)}</ul>
      </div>
      <Button type="button" disabled={busy || disabled || keyConflict} onClick={() => void sendIntent(pendingIntent)}><RefreshCw size={17} />{i18n.t('ui.customerOrder.retry')}</Button>
    </div> : null}
    {open && priceConflict && !pendingIntent ? <div className="customer-order-price-review"><span>{unavailableIds.size > 0 ? i18n.t('ui.customerOrder.removeUnavailable') : i18n.t('ui.customerOrder.menuChanged')}</span><Button type="button" variant="secondary" disabled={!menu.hasData || menu.isRefreshing || Boolean(menu.error) || unavailableIds.size > 0} onClick={acceptPrices}>{i18n.t('ui.customerOrder.acceptPrices')}</Button></div> : null}
    {open && session.canCreateOrder ? <div className="customer-order-compose-grid">
      <div className="customer-order-compose-menu">
        <div className="customer-order-compose-title"><h4>{i18n.t('ui.customerOrder.menu')}</h4><Button type="button" variant="secondary" aria-label={i18n.t('ui.customerOrder.refreshMenu')} title={i18n.t('ui.customerOrder.refreshMenu')} onClick={() => setMenuRevision((value) => value + 1)}><RefreshCw size={16} /></Button></div>
        <div className="customer-order-compose-filters">
          <label>{i18n.t('ui.customerOrder.search')}<span><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></span></label>
          <label>{i18n.t('ui.customerOrder.category')}<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">{i18n.t('ui.customerOrder.allCategories')}</option>{menu.data.categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </div>
        {menu.isLoading ? <p role="status">{i18n.t('ui.pages.staff.waiter_session_orders_page.menyu_yuklenir_b8bb64')}</p> : null}
        {menu.error ? <StatusMessage tone="danger" autoHideMs={false}>{menu.error}</StatusMessage> : null}
        {menu.hasData && !menu.error && visibleItems.length === 0 ? <p className="customer-orders-muted">{i18n.t('ui.pages.staff.waiter_session_orders_page.uygun_mehsul_tapilmadi_5efc83')}</p> : null}
        <div className="customer-order-compose-items">{visibleItems.map((item) => <div className="customer-order-compose-item" key={item.id}><div><strong>{item.name}</strong><small>{item.categoryName}</small></div><strong>{money(item.price)}</strong><Button type="button" variant="secondary" disabled={!canEdit} aria-label={i18n.t('ui.customerOrder.addItem', { name: item.name })} title={i18n.t('ui.customerOrder.addItem', { name: item.name })} onClick={() => addItem(item)}><Plus size={17} /></Button></div>)}</div>
      </div>
      <div className="customer-order-compose-cart">
        <div className="customer-order-compose-title"><h4>{i18n.t('ui.customerOrder.cart')} · {itemCount}</h4><ShoppingBasket size={18} /></div>
        {cart.length === 0 ? <p className="customer-orders-muted">{i18n.t('ui.customerOrder.emptyCart')}</p> : <div className="customer-order-compose-lines">{cart.map((line) => <div className="customer-order-compose-line" key={line.item.id}>
          <div className="customer-order-compose-line-main"><strong>{line.item.name}{unavailableIds.has(line.item.id) ? <small className="customer-order-compose-unavailable">{i18n.t('ui.customerOrder.unavailableItem')}</small> : null}</strong><strong>{money(line.item.price * line.quantity)}</strong></div>
          <div className="customer-order-compose-line-tools"><div className="customer-order-compose-stepper"><button type="button" disabled={!canEdit} aria-label={i18n.t('ui.customerOrder.decrease', { name: line.item.name })} onClick={() => changeQuantity(line.item.id, -1)}><Minus size={15} /></button><span>{line.quantity}</span><button type="button" disabled={!canEdit || line.quantity >= 100} aria-label={i18n.t('ui.customerOrder.increase', { name: line.item.name })} onClick={() => changeQuantity(line.item.id, 1)}><Plus size={15} /></button></div><button type="button" disabled={!canEdit} aria-label={i18n.t('ui.customerOrder.remove', { name: line.item.name })} title={i18n.t('ui.customerOrder.remove', { name: line.item.name })} onClick={() => setCart((current) => current.filter((entry) => entry.item.id !== line.item.id))}><Trash2 size={16} /></button></div>
          <label>{i18n.t('ui.customerOrder.itemNote')}<input value={line.note} maxLength={500} disabled={!canEdit} onChange={(event) => setCart((current) => current.map((entry) => entry.item.id === line.item.id ? { ...entry, note: event.target.value } : entry))} placeholder={i18n.t('ui.customerOrder.optional')} /></label>
        </div>)}</div>}
        <label className="customer-order-compose-general-note">{i18n.t('ui.customerOrder.orderNote')}<textarea value={note} maxLength={1000} rows={2} disabled={!canEdit} onChange={(event) => setNote(event.target.value)} placeholder={i18n.t('ui.customerOrder.optional')} /></label>
        <div className="customer-order-compose-footer"><span>{i18n.t('ui.customerOrder.itemTotal')}<strong>{money(subtotal)}</strong></span><Button type="button" disabled={!canEdit || !cart.length || priceConflict} onClick={submit}>{busy ? i18n.t('ui.customerOrder.sending') : i18n.t('ui.customerOrder.submit')}</Button></div>
      </div>
    </div> : null}
  </section>
}
