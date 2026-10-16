import { BadgeCheck, Check, ClipboardList, CookingPot, LoaderCircle, RefreshCw, Store } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useKitchenQueue } from '../../features/orders/useKitchenQueue'
import type { KitchenOrderResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import type { KitchenProgressAction } from '../../shared/api/endpoints'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { orderKitchenLabel, orderStatusId } from '../../shared/lib/orderStatus'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './kitchen-board.css'

type OrderActionState = { action: KitchenProgressAction; phase: 'busy' | 'uncertain' | 'error'; message: string }

const nextStatus: Record<KitchenProgressAction, number> = {
  accept: orderStatusId.accepted,
  start: orderStatusId.preparing,
  ready: orderStatusId.ready,
}

// Düymələr status təxminindən yox, API-nin cari icazə bayraqlarından yaranır.
function availableAction(order: KitchenOrderResponse): KitchenProgressAction | null {
  if (order.canAccept) return 'accept'
  if (order.canStartPreparing) return 'start'
  if (order.canMarkReady) return 'ready'
  return null
}

// Mətbəx bileti yalnız hazırlıq üçün lazım olan məlumatı və restoranın yerli vaxtını göstərir.
function KitchenTicket({ order, actionState, onAction }: { order: KitchenOrderResponse; actionState?: OrderActionState; onAction: (action: KitchenProgressAction) => void }) {
  const action = actionState?.phase === 'uncertain' ? actionState.action : availableAction(order)
  const actionLabel = action === 'accept' ? 'Qəbul et' : action === 'start' ? 'Hazırlamağa başla' : 'Hazırdır'
  const ActionIcon = action === 'accept' ? Check : action === 'start' ? CookingPot : BadgeCheck
  const stageAt = order.readyAt || order.preparingAt || order.acceptedAt
  return <article className="kitchen-queue-row">
    <div className="kitchen-queue-order"><strong>#{order.id}</strong><span>{formatReservationDateTime(order.sentToKitchenAt, order.timeZone)}</span></div>
    <div className="kitchen-queue-table"><span>Masa</span><strong>{order.tableName || `Masa-${order.tableId}`}</strong></div>
    <div className="kitchen-queue-items"><ul>{order.items.map((item) => <li key={item.id}><strong>{item.quantity} × {item.name}</strong>{item.note ? <small>{item.note}</small> : null}</li>)}</ul>{order.note ? <p><strong>Qeyd:</strong> {order.note}</p> : null}</div>
    <div className={`kitchen-queue-state${order.statusId === orderStatusId.ready ? ' is-ready' : order.statusId === orderStatusId.preparing ? ' is-preparing' : ''}`}>
      <span>{orderKitchenLabel(order.statusId, order.sentToKitchenAt)}</span>
      {stageAt ? <small>{formatReservationDateTime(stageAt, order.timeZone)}</small> : null}
      {action ? <Button type="button" variant="secondary" disabled={actionState?.phase === 'busy'} onClick={() => onAction(action)}>
        {actionState?.phase === 'busy' ? <LoaderCircle className="kitchen-action-spinner" size={16} /> : <ActionIcon size={16} />}
        {actionState?.phase === 'busy' ? 'İcra olunur...' : actionState?.phase === 'uncertain' ? `Təkrar: ${actionLabel}` : actionLabel}
      </Button> : null}
      {actionState?.phase === 'uncertain' ? <small className="kitchen-action-warning" role="alert">{actionState.message}</small> : null}
      {actionState?.phase === 'error' ? <small className="kitchen-action-error" role="alert">{actionState.message}</small> : null}
    </div>
  </article>
}

// Eyni səhifədə yalnız seçilmiş restoranın növbəsi saxlanır və səhifələnir.
function KitchenQueue({ userId, restaurantId }: { userId: string; restaurantId: string }) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [actionStates, setActionStates] = useState<Record<number, OrderActionState>>({})
  const [warning, setWarning] = useState('')
  const busyOrdersRef = useRef(new Set<number>())
  const activeRef = useRef(true)
  const pageRef = useRef(page)
  pageRef.current = page
  const queue = useKitchenQueue(userId, restaurantId, page, revision)

  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false }
  }, [])

  useEffect(() => {
    if (queue.data && page > queue.data.totalPages) setPage(Math.max(1, queue.data.totalPages))
  }, [queue.data, page])

  useEffect(() => {
    if (!queue.data) return
    setActionStates((current) => {
      let next = current
      for (const [id, state] of Object.entries(current)) {
        if (state.phase !== 'uncertain') continue
        const order = queue.data?.items.find((item) => item.id === Number(id))
        if (order && order.statusId >= nextStatus[state.action]) {
          if (next === current) next = { ...current }
          delete next[Number(id)]
        }
      }
      return next
    })
  }, [queue.data])

  // Kilid sifariş üzrədir: başqa masaların əməliyyatları paralel gedə bilir.
  async function runAction(orderId: number, action: KitchenProgressAction) {
    const order = queue.data?.items.find((item) => item.id === orderId)
    const retrying = actionStates[orderId]?.phase === 'uncertain' && actionStates[orderId].action === action
    if (!order || busyOrdersRef.current.has(orderId) || (!retrying && availableAction(order) !== action)) return
    if (order.statusId >= nextStatus[action]) {
      setRevision((value) => value + 1)
      return
    }
    busyOrdersRef.current.add(orderId)
    const requestPage = page
    setWarning('')
    setActionStates((current) => ({ ...current, [orderId]: { action, phase: 'busy', message: '' } }))
    try {
      const updated = await ecafeApi.kitchen.progressOrder(restaurantId, orderId, action)
      if (updated.id !== orderId || String(updated.restaurantId) !== restaurantId || updated.statusId < nextStatus[action]) {
        throw new Error('Əməliyyatın cavabı təsdiqlənmədi.')
      }
      if (!activeRef.current || pageRef.current !== requestPage) return
      queue.applyOrder(updated)
      setActionStates((current) => {
        const next = { ...current }
        delete next[orderId]
        return next
      })
      setRevision((value) => value + 1)
    } catch (error) {
      if (!activeRef.current || pageRef.current !== requestPage) return
      if (error instanceof ApiError && error.statusCode === 409) {
        setWarning('Sifarişin statusu başqa əməkdaş tərəfindən dəyişdirilib. Növbə yenilənir.')
        setActionStates((current) => {
          const next = { ...current }
          delete next[orderId]
          return next
        })
      } else if (error instanceof ApiError && [403, 404].includes(error.statusCode)) {
        setWarning('Bu sifariş artıq əlçatan deyil və ya icazəniz dəyişib. Növbə yenilənir.')
        setActionStates((current) => {
          const next = { ...current }
          delete next[orderId]
          return next
        })
      } else if (error instanceof ApiError && [400, 422].includes(error.statusCode)) {
        setActionStates((current) => ({ ...current, [orderId]: { action, phase: 'error', message: normalizeCaughtApiError(error, 'Əməliyyat icra olunmadı.').message } }))
      } else {
        setActionStates((current) => ({ ...current, [orderId]: { action, phase: 'uncertain', message: 'Nəticə məlum deyil. Yalnız bu əməliyyatı təkrar yoxlayın.' } }))
      }
      setRevision((value) => value + 1)
    } finally {
      busyOrdersRef.current.delete(orderId)
      if (activeRef.current) {
        setActionStates((current) => {
          if (current[orderId]?.phase !== 'busy' || current[orderId].action !== action) return current
          const next = { ...current }
          delete next[orderId]
          return next
        })
      }
    }
  }

  return <section className="kitchen-queue" aria-label="Mətbəx sifarişləri">
    <div className="kitchen-queue-toolbar"><div><span>NÖVBƏ</span><strong>{queue.data && !queue.error ? `${queue.data.totalCount} sifariş` : 'Sifarişlər'}</strong></div><Button type="button" variant="secondary" aria-label="Növbəni yenilə" title="Növbəni yenilə" onClick={() => { setWarning(''); setRevision((value) => value + 1) }}><RefreshCw size={18} /></Button></div>
    {queue.isRefreshing ? <span className="kitchen-queue-refreshing" role="status">Yenilənir...</span> : null}
    {queue.isLoading ? <p className="kitchen-queue-loading" role="status">Növbə yüklənir...</p> : null}
    {warning ? <StatusMessage tone="warning" autoHideMs={false}>{warning}</StatusMessage> : null}
    {queue.error ? <StatusMessage tone="danger" autoHideMs={false}>Növbə yüklənmədi: {queue.error}</StatusMessage> : null}
    {queue.data && queue.data.items.length === 0 ? <div className="kitchen-queue-empty"><ClipboardList size={24} aria-hidden="true" /><strong>Hazırda sifariş yoxdur</strong></div> : null}
    {queue.data && queue.data.items.length > 0 ? <div className="kitchen-queue-list"><div className="kitchen-queue-columns" aria-hidden="true"><span>Sifariş / vaxt</span><span>Masa</span><span>Məhsullar</span><span>Vəziyyət / əməliyyat</span></div>{queue.data.items.map((order) => <KitchenTicket key={order.id} order={order} actionState={actionStates[order.id]} onAction={(action) => void runAction(order.id, action)} />)}</div> : null}
    {queue.data ? <PaginationControls ariaLabel="Mətbəx növbəsi səhifələri" pageIndex={queue.data.pageIndex} totalPages={queue.data.totalPages} totalCount={queue.data.totalCount} pageSize={20} hasPreviousPage={queue.data.hasPreviousPage} hasNextPage={queue.data.hasNextPage} onPageChange={setPage} /> : null}
  </section>
}

export function KitchenBoardPage() {
  const { user, selectProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const kitchenProfiles = useMemo(() => user?.profiles.filter((profile) => profile.roleId === RoleIds.Kitchen && profile.isActive !== false) || [], [user])
  const restaurants = useMemo(() => kitchenProfiles.length ? kitchenProfiles : user?.roleId === RoleIds.Kitchen && user.restaurantId
    ? [{ restaurantId: user.restaurantId, roleId: RoleIds.Kitchen, restaurantName: 'Restoran' }] : [], [kitchenProfiles, user])
  const requestedRestaurantId = searchParams.get('restaurantId') || ''
  const activeRestaurantId = restaurants.find((profile) => profile.restaurantId === user?.restaurantId)?.restaurantId || restaurants[0]?.restaurantId || ''
  const restaurantId = restaurants.find((profile) => profile.restaurantId === requestedRestaurantId)?.restaurantId || activeRestaurantId
  const contextReady = Boolean(user && restaurantId && user.restaurantId === restaurantId && user.roleId === RoleIds.Kitchen)

  useEffect(() => {
    if (restaurantId && !contextReady) selectProfile({ restaurantId, roleId: RoleIds.Kitchen })
  }, [restaurantId, contextReady, selectProfile])

  // API sorğusundan əvvəl aktiv profil də dəyişir ki tenant header-i URL ilə uyğun olsun.
  function changeRestaurant(nextId: string) {
    setSearchParams(nextId ? { restaurantId: nextId } : {})
    selectProfile({ restaurantId: nextId, roleId: RoleIds.Kitchen })
  }

  return <main className="staff-page kitchen-page">
    <PageHeader eyebrow="MƏTBƏX" title="Sifariş növbəsi" />
    <div className="kitchen-context">
      {restaurants.length > 1 ? <label>Restoran<select value={restaurantId} onChange={(event) => changeRestaurant(event.target.value)}>{restaurants.map((profile) => <option key={profile.restaurantId} value={profile.restaurantId}>{profile.restaurantName || `Restoran ${profile.restaurantId}`}</option>)}</select></label>
        : <div><span>Restoran</span><strong><Store size={17} aria-hidden="true" />{restaurants[0]?.restaurantName || 'Restoran'}</strong></div>}
    </div>
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>Aktiv mətbəx restoranı tapılmadı.</StatusMessage> : null}
    {restaurantId && !contextReady ? <p role="status">Restoran konteksti yüklənir...</p> : null}
    {contextReady && user ? <KitchenQueue key={`${user.userId}:${restaurantId}`} userId={user.userId} restaurantId={restaurantId} /> : null}
  </main>
}
