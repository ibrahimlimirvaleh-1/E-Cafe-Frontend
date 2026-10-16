import { ClipboardList, RefreshCw, Store } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useKitchenQueue } from '../../features/orders/useKitchenQueue'
import type { KitchenOrderResponse } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { orderKitchenLabel, orderStatusId } from '../../shared/lib/orderStatus'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './kitchen-board.css'

// Mətbəx bileti yalnız hazırlıq üçün lazım olan məlumatı və restoranın yerli vaxtını göstərir.
function KitchenTicket({ order }: { order: KitchenOrderResponse }) {
  return <article className="kitchen-queue-row">
    <div className="kitchen-queue-order"><strong>#{order.id}</strong><span>{formatReservationDateTime(order.sentToKitchenAt, order.timeZone)}</span></div>
    <div className="kitchen-queue-table"><span>Masa</span><strong>{order.tableName || `Masa-${order.tableId}`}</strong></div>
    <div className="kitchen-queue-items"><ul>{order.items.map((item) => <li key={item.id}><strong>{item.quantity} × {item.name}</strong>{item.note ? <small>{item.note}</small> : null}</li>)}</ul>{order.note ? <p><strong>Qeyd:</strong> {order.note}</p> : null}</div>
    <div className={`kitchen-queue-state${order.statusId === orderStatusId.ready ? ' is-ready' : order.statusId === orderStatusId.preparing ? ' is-preparing' : ''}`}><span>{orderKitchenLabel(order.statusId, order.sentToKitchenAt)}</span></div>
  </article>
}

// Eyni səhifədə yalnız seçilmiş restoranın növbəsi saxlanır və səhifələnir.
function KitchenQueue({ userId, restaurantId }: { userId: string; restaurantId: string }) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const queue = useKitchenQueue(userId, restaurantId, page, revision)

  useEffect(() => {
    if (queue.data && page > queue.data.totalPages) setPage(Math.max(1, queue.data.totalPages))
  }, [queue.data, page])

  return <section className="kitchen-queue" aria-label="Mətbəx sifarişləri">
    <div className="kitchen-queue-toolbar"><div><span>NÖVBƏ</span><strong>{queue.data && !queue.error ? `${queue.data.totalCount} sifariş` : 'Sifarişlər'}</strong></div><Button type="button" variant="secondary" aria-label="Növbəni yenilə" title="Növbəni yenilə" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={18} /></Button></div>
    {queue.isRefreshing ? <span className="kitchen-queue-refreshing" role="status">Yenilənir...</span> : null}
    {queue.isLoading ? <p className="kitchen-queue-loading" role="status">Növbə yüklənir...</p> : null}
    {queue.error ? <StatusMessage tone="danger" autoHideMs={false}>Növbə yüklənmədi: {queue.error}</StatusMessage> : null}
    {queue.data && queue.data.items.length === 0 ? <div className="kitchen-queue-empty"><ClipboardList size={24} aria-hidden="true" /><strong>Hazırda sifariş yoxdur</strong></div> : null}
    {queue.data && queue.data.items.length > 0 ? <div className="kitchen-queue-list"><div className="kitchen-queue-columns" aria-hidden="true"><span>Sifariş / vaxt</span><span>Masa</span><span>Məhsullar</span><span>Vəziyyət</span></div>{queue.data.items.map((order) => <KitchenTicket key={order.id} order={order} />)}</div> : null}
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
