import { i18n } from '../../shared/i18n/i18n'
import { BadgeCheck, Check, ClipboardList, CookingPot, LoaderCircle, RefreshCw, Store } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useKitchenQueue } from '../../features/orders/useKitchenQueue'
import type { KitchenOrderResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import type { KitchenProgressAction } from '../../shared/api/endpoints'
import { ApiError, normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { orderKitchenLabel, orderStatusId } from '../../shared/lib/orderStatus'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './kitchen-board.css'

type OrderActionState = { action: KitchenProgressAction; phase: 'busy' | 'uncertain' | 'error'; message: string; details?: ApiErrorDetail[] }

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
function elapsedMinutes(since: string | null | undefined, now: number) {
  const startedAt = since ? Date.parse(since) : NaN
  if (!Number.isFinite(startedAt) || startedAt > now) return null
  return Math.floor((now - startedAt) / 60_000)
}

function KitchenTicket({ order, actionState, actionsDisabled, now, onAction }: { order: KitchenOrderResponse; actionState?: OrderActionState; actionsDisabled: boolean; now: number; onAction: (action: KitchenProgressAction) => void }) {
  const action = actionState?.phase === 'uncertain' ? actionState.action : availableAction(order)
  const actionLabel = i18n.t(action === 'accept' ? 'ui.kitchenQueue.accept' : action === 'start' ? 'ui.kitchenQueue.start' : 'ui.kitchenQueue.ready')
  const ActionIcon = action === 'accept' ? Check : action === 'start' ? CookingPot : BadgeCheck
  const stageAt = order.readyAt || order.preparingAt || order.acceptedAt
  const queueMinutes = elapsedMinutes(order.sentToKitchenAt, now)
  const stageMinutes = elapsedMinutes(stageAt, now)
  const stageElapsedKey = order.statusId === orderStatusId.accepted ? 'ui.kitchenQueue.acceptedElapsed'
    : order.statusId === orderStatusId.preparing ? 'ui.kitchenQueue.preparationElapsed'
      : order.statusId === orderStatusId.ready ? 'ui.kitchenQueue.readyWaiting' : 'ui.kitchenQueue.inStage'
  return <article className="kitchen-queue-row">
    <div className="kitchen-queue-order"><strong>#{order.id}</strong><span>{formatReservationDateTime(order.sentToKitchenAt, order.timeZone)}</span>{queueMinutes !== null ? <small className="kitchen-queue-elapsed">{i18n.t(stageAt ? 'ui.kitchenQueue.inQueue' : 'ui.kitchenQueue.waiting')}: {queueMinutes ? `${queueMinutes} ${i18n.t('ui.kitchenQueue.minuteShort')}` : i18n.t('ui.kitchenQueue.lessThanMinute')}</small> : null}</div>
    <div className="kitchen-queue-table"><span>{i18n.t('ui.pages.staff.kitchen_board_page.masa_058c4c')}</span><strong>{order.tableName || `Masa-${order.tableId}`}</strong></div>
    <div className="kitchen-queue-items"><ul>{order.items.map((item) => <li key={item.id}><strong>{item.quantity} × {item.name}</strong>{item.note ? <small>{item.note}</small> : null}</li>)}</ul>{order.note ? <p><strong>{i18n.t('ui.pages.staff.kitchen_board_page.qeyd_2d4f8a')}</strong> {order.note}</p> : null}</div>
    <div className={`kitchen-queue-state${order.statusId === orderStatusId.ready ? ' is-ready' : order.statusId === orderStatusId.preparing ? ' is-preparing' : ''}`}>
      <span>{orderKitchenLabel(order.statusId, order.sentToKitchenAt)}</span>
      {stageAt ? <small>{formatReservationDateTime(stageAt, order.timeZone)}</small> : null}
      {stageMinutes !== null ? <small className="kitchen-queue-elapsed">{i18n.t(stageElapsedKey)}: {stageMinutes ? `${stageMinutes} ${i18n.t('ui.kitchenQueue.minuteShort')}` : i18n.t('ui.kitchenQueue.lessThanMinute')}</small> : null}
      {action ? <Button type="button" variant="secondary" disabled={actionsDisabled || actionState?.phase === 'busy'} onClick={() => onAction(action)}>
        {actionState?.phase === 'busy' ? <LoaderCircle className="kitchen-action-spinner" size={16} /> : <ActionIcon size={16} />}
        {actionState?.phase === 'busy' ? i18n.t('ui.pages.staff.kitchen_board_page.icra_olunur_e4744c') : actionState?.phase === 'uncertain' ? `${i18n.t('ui.kitchenQueue.retry')}: ${actionLabel}` : actionLabel}
      </Button> : null}
      {actionState?.phase === 'uncertain' ? <small className="kitchen-action-warning" role="alert">{actionState.message}</small> : null}
    </div>
    {actionState?.phase === 'error' ? <StatusMessage className="kitchen-ticket-error" tone="danger" autoHideMs={false} dismissible={false} details={actionState.details}>{actionState.message}</StatusMessage> : null}
  </article>
}

// Eyni səhifədə yalnız seçilmiş restoranın növbəsi saxlanır və səhifələnir.
function KitchenQueue({ userId, restaurantId }: { userId: string; restaurantId: string }) {
  const [page, setPage] = useState(1)
  const [statusId, setStatusId] = useState<number | null>(null)
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [actionStates, setActionStates] = useState<Record<number, OrderActionState>>({})
  const [warning, setWarning] = useState('')
  const busyOrdersRef = useRef(new Set<number>())
  const activeRef = useRef(true)
  const pageRef = useRef(page)
  const statusRef = useRef(statusId)
  const scopeGenerationRef = useRef(0)
  const renderedScopeRef = useRef(`${statusId ?? 'all'}:${page}`)
  const renderedScope = `${statusId ?? 'all'}:${page}`
  if (renderedScopeRef.current !== renderedScope) {
    renderedScopeRef.current = renderedScope
    scopeGenerationRef.current += 1
  }
  pageRef.current = page
  statusRef.current = statusId
  const queue = useKitchenQueue(userId, restaurantId, page, statusId, revision)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false }
  }, [])

  useEffect(() => {
    if (queue.data && page > queue.data.totalPages) {
      scopeGenerationRef.current += 1
      setPage(Math.max(1, queue.data.totalPages))
    }
  }, [queue.data, page])

  useEffect(() => {
    if (!queue.data) return
    setActionStates((current) => {
      let next = current
      for (const [id, state] of Object.entries(current)) {
        if (state.phase !== 'uncertain' && state.phase !== 'error') continue
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
    if (queue.isStale || queue.error) return
    const order = queue.data?.items.find((item) => item.id === orderId)
    const retrying = actionStates[orderId]?.phase === 'uncertain' && actionStates[orderId].action === action
    if (!order || busyOrdersRef.current.has(orderId) || (!retrying && availableAction(order) !== action)) return
    if (order.statusId >= nextStatus[action]) {
      setRevision((value) => value + 1)
      return
    }
    busyOrdersRef.current.add(orderId)
    const requestPage = page
    const requestStatus = statusId
    const requestGeneration = scopeGenerationRef.current
    setWarning('')
    setActionStates((current) => ({ ...current, [orderId]: { action, phase: 'busy', message: '' } }))
    try {
      const updated = await ecafeApi.kitchen.progressOrder(restaurantId, orderId, action)
      if (updated.id !== orderId || String(updated.restaurantId) !== restaurantId || updated.statusId < nextStatus[action]) {
        throw new Error('Əməliyyatın cavabı təsdiqlənmədi.')
      }
      if (!activeRef.current) return
      queue.applyOrder(updated)
      if (pageRef.current !== requestPage || statusRef.current !== requestStatus || scopeGenerationRef.current !== requestGeneration) {
        setRevision((value) => value + 1)
        return
      }
      setActionStates((current) => {
        const next = { ...current }
        delete next[orderId]
        return next
      })
      setRevision((value) => value + 1)
    } catch (error) {
      if (!activeRef.current) return
      if (pageRef.current !== requestPage || statusRef.current !== requestStatus || scopeGenerationRef.current !== requestGeneration) {
        setRevision((value) => value + 1)
        return
      }
      if (error instanceof ApiError && error.statusCode === 409) {
        const feedback = normalizeCaughtApiError(error, 'Əməliyyat icra olunmadı.')
        setActionStates((current) => ({ ...current, [orderId]: { action, phase: 'error', message: feedback.message, details: feedback.details } }))
      } else if (error instanceof ApiError && [403, 404].includes(error.statusCode)) {
        setWarning('Bu sifariş artıq əlçatan deyil və ya icazəniz dəyişib. Növbə yenilənir.')
        setActionStates((current) => {
          const next = { ...current }
          delete next[orderId]
          return next
        })
      } else if (error instanceof ApiError && [400, 422].includes(error.statusCode)) {
        const feedback = normalizeCaughtApiError(error, 'Əməliyyat icra olunmadı.')
        setActionStates((current) => ({ ...current, [orderId]: { action, phase: 'error', message: feedback.message, details: feedback.details } }))
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

  return <section className="kitchen-queue" aria-label={i18n.t('ui.pages.staff.kitchen_board_page.metbex_sifarisleri_a9f03c')}>
    <div className="kitchen-queue-toolbar"><div><span>{i18n.t('ui.pages.staff.kitchen_board_page.novbe_5c1a72')}</span><strong>{queue.data ? i18n.t('ui.count.orders', { count: queue.data.totalCount }) : i18n.t('ui.pages.staff.kitchen_board_page.sifarisler_0b5f10')}</strong></div><Button type="button" variant="secondary" aria-label={i18n.t('ui.pages.staff.kitchen_board_page.novbeni_yenile_7675cd')} title={i18n.t('ui.pages.staff.kitchen_board_page.novbeni_yenile_7675cd')} onClick={() => { setWarning(''); setRevision((value) => value + 1) }}><RefreshCw size={18} /></Button></div>
    {queue.lastSuccessAt ? <span className="kitchen-queue-last-updated">{i18n.t('ui.kitchenQueue.lastUpdated')}: {new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(queue.lastSuccessAt)}</span> : null}
    <div className="kitchen-queue-filters" role="group" aria-label={i18n.t('ui.kitchenQueue.stageFilter')}>
      {([null, orderStatusId.created, orderStatusId.accepted, orderStatusId.preparing, orderStatusId.ready] as const).map((stage) => <button key={stage ?? 'all'} type="button" aria-pressed={statusId === stage} onClick={() => { if (statusId === stage) return; scopeGenerationRef.current += 1; setPage(1); setStatusId(stage); setWarning('') }}>{stage === null ? i18n.t('ui.kitchenQueue.allStages') : orderKitchenLabel(stage, stage === orderStatusId.created ? 'sent' : null)}</button>)}
    </div>
    {queue.isRefreshing ? <span className="kitchen-queue-refreshing" role="status">{i18n.t('ui.pages.staff.kitchen_board_page.yenilenir_283de5')}</span> : null}
    {queue.isLoading ? <p className="kitchen-queue-loading" role="status">{i18n.t('ui.pages.staff.kitchen_board_page.novbe_yuklenir_aaa679')}</p> : null}
    {warning ? <StatusMessage tone="warning" autoHideMs={false}>{warning}</StatusMessage> : null}
    {queue.error ? <StatusMessage tone={queue.isStale ? 'warning' : 'danger'} autoHideMs={false}>{queue.isStale ? `${i18n.t('ui.kitchenQueue.staleQueue')} ${queue.error}` : `${i18n.t('ui.pages.staff.kitchen_board_page.novbe_yuklenmedi_a17c37')} ${queue.error}`}</StatusMessage> : null}
    {queue.data && queue.data.items.length === 0 ? <div className="kitchen-queue-empty"><ClipboardList size={24} aria-hidden="true" /><strong>{i18n.t('ui.pages.staff.kitchen_board_page.hazirda_sifaris_yoxdur_927267')}</strong></div> : null}
    {queue.data && queue.data.items.length > 0 ? <div className="kitchen-queue-list"><div className="kitchen-queue-columns" aria-hidden="true"><span>{i18n.t('ui.pages.staff.kitchen_board_page.sifaris_vaxt_e1170e')}</span><span>{i18n.t('ui.pages.staff.kitchen_board_page.masa_058c4c')}</span><span>{i18n.t('ui.pages.staff.kitchen_board_page.mehsullar_dbcc49')}</span><span>{i18n.t('ui.pages.staff.kitchen_board_page.veziyyet_emeliyyat_12c45b')}</span></div>{queue.data.items.map((order) => <KitchenTicket key={order.id} order={order} actionState={actionStates[order.id]} actionsDisabled={queue.isStale || Boolean(queue.error)} now={now} onAction={(action) => void runAction(order.id, action)} />)}</div> : null}
    {queue.data ? <PaginationControls ariaLabel={i18n.t('ui.pages.staff.kitchen_board_page.metbex_novbesi_sehifeleri_bf1e48')} pageIndex={queue.data.pageIndex} totalPages={queue.data.totalPages} totalCount={queue.data.totalCount} pageSize={20} hasPreviousPage={queue.data.hasPreviousPage} hasNextPage={queue.data.hasNextPage} onPageChange={(nextPage) => { scopeGenerationRef.current += 1; setPage(nextPage) }} /> : null}
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
    <PageHeader eyebrow={i18n.t('ui.pages.staff.kitchen_board_page.metbex_f31fd7')} title={i18n.t('ui.pages.staff.kitchen_board_page.sifaris_novbesi_20d0d4')} />
    <div className="kitchen-context">
      {restaurants.length > 1 ? <label>{i18n.t('ui.pages.staff.kitchen_board_page.restoran_c4df56')}<select value={restaurantId} onChange={(event) => changeRestaurant(event.target.value)}>{restaurants.map((profile) => <option key={profile.restaurantId} value={profile.restaurantId}>{profile.restaurantName || `Restoran ${profile.restaurantId}`}</option>)}</select></label>
        : <div><span>{i18n.t('ui.pages.staff.kitchen_board_page.restoran_c4df56')}</span><strong><Store size={17} aria-hidden="true" />{restaurants[0]?.restaurantName || 'Restoran'}</strong></div>}
    </div>
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.pages.staff.kitchen_board_page.aktiv_metbex_restorani_tapilmadi_b0b3f1')}</StatusMessage> : null}
    {restaurantId && !contextReady ? <p role="status">{i18n.t('ui.pages.staff.kitchen_board_page.restoran_konteksti_yuklenir_4dcead')}</p> : null}
    {contextReady && user ? <KitchenQueue key={`${user.userId}:${restaurantId}`} userId={user.userId} restaurantId={restaurantId} /> : null}
  </main>
}
