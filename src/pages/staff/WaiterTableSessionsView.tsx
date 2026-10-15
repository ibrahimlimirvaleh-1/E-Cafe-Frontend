import { CalendarClock, Clock3, RefreshCw, Store, Table2, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ecafeApi, type WaiterTableSessionResponse } from '../../shared/api/ecafeApi'
import { ApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './waiter-sessions.css'

const emptyPage: PaginatedResponse<WaiterTableSessionResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasPreviousPage: false, hasNextPage: false,
}

type SessionDetail = { kind: 'found'; session: WaiterTableSessionResponse } | { kind: 'missing' }

type Props = {
  restaurantId: string
  restaurantName: string
  restaurantOptions: { id: string; name: string }[]
  onRestaurantChange: (restaurantId: string) => void
  reloadKey: number
}

// Masa adı verilməyəndə nömrə ilə oxunaqlı ad göstərir.
function tableLabel(session: WaiterTableSessionResponse) {
  return session.tableName?.trim() || `Masa-${session.tableNo}`
}

// UTC vaxtını restoranın saat qurşağına görə göstərir.
function sessionTime(value: string, timeZone: string) {
  return formatReservationDateTime(value, timeZone || 'Asia/Baku')
}

export function WaiterTableSessionsView({ restaurantId, restaurantName, restaurantOptions, onRestaurantChange, reloadKey }: Props) {
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [listRevision, setListRevision] = useState(0)
  const [detailRevision, setDetailRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const listKey = `${restaurantId}:${page}`
  const list = useKeyedAsyncData(
    () => restaurantId ? ecafeApi.tableSessions.listMine(restaurantId, page) : Promise.resolve(emptyPage),
    emptyPage,
    listKey,
    [reloadKey, listRevision],
  )
  const detailKey = selectedId === null ? '' : `${restaurantId}:${selectedId}`
  const detail = useKeyedAsyncData<SessionDetail | null>(
    async () => {
      if (!restaurantId || selectedId === null) return null
      try {
        return { kind: 'found', session: await ecafeApi.tableSessions.getMineById(restaurantId, selectedId) }
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) return { kind: 'missing' }
        throw error
      }
    },
    null,
    detailKey,
    [reloadKey, detailRevision],
  )

  useEffect(() => {
    if (!detail.hasData || detail.data?.kind !== 'missing') return
    setSelectedId(null)
    setNotice('Bu masa sessiyası artıq açıq deyil. Siyahı yeniləndi.')
    setListRevision((value) => value + 1)
  }, [detail.data, detail.hasData])

  useEffect(() => {
    if (!list.hasData || page <= list.data.totalPages) return
    setPage(Math.max(1, list.data.totalPages))
    setSelectedId(null)
  }, [list.data.totalPages, list.hasData, page])

  const sessions = list.error ? [] : list.data.items
  const selected = !detail.error && detail.hasData && detail.data?.kind === 'found' ? detail.data.session : null

  // Siyahı və açıq detal birlikdə yenilənir; bağlanmış sessiya 404 qaytararsa detal silinir.
  function refreshSessions() {
    setNotice('')
    setListRevision((value) => value + 1)
    setDetailRevision((value) => value + 1)
  }

  return <section className="waiter-sessions-view" aria-label="Xidmət etdiyim masalar">
    <div className="waiter-sessions-toolbar">
      {restaurantOptions.length > 1 ? <label className="waiter-sessions-restaurant">Restoran
        <select value={restaurantId} onChange={(event) => onRestaurantChange(event.target.value)}>
          {restaurantOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label> : <div className="waiter-sessions-restaurant-name"><span>Restoran</span><strong><Store size={18} aria-hidden="true" />{restaurantName}</strong></div>}
      <Button type="button" variant="secondary" onClick={refreshSessions} title="Masa sessiyalarını yenilə" aria-label="Masa sessiyalarını yenilə"><RefreshCw size={18} /></Button>
    </div>
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>Sizə aid restoran tapılmadı.</StatusMessage> : null}
    {list.error ? <StatusMessage tone="danger" autoHideMs={false}>{list.error}</StatusMessage> : null}
    {notice ? <StatusMessage tone="warning" autoHideMs={false}>{notice}</StatusMessage> : null}
    <div className="waiter-sessions-summary"><strong>{list.hasData && !list.error ? `${list.data.totalCount} açıq masa` : 'Açıq masalar'}</strong>{list.isRefreshing ? <span role="status">Yenilənir...</span> : null}</div>
    {list.isLoading ? <p className="waiter-reservations-muted" role="status">Masa sessiyaları yüklənir...</p> : null}
    {!list.isLoading && !list.error && list.hasData && sessions.length === 0 ? <div className="waiter-reservations-empty" role="status">
      <span className="waiter-reservations-empty-icon"><Table2 size={22} aria-hidden="true" /></span>
      <div><strong>Açıq masa sessiyası yoxdur</strong><p>Hazırda sizə təyin edilmiş açıq masa tapılmadı.</p></div>
    </div> : null}
    {list.hasData && sessions.length > 0 ? <div className="waiter-sessions-layout">
      <div className="waiter-sessions-list" aria-label="Açıq masa sessiyaları">
        {sessions.map((session) => <button className={`waiter-session-row${selectedId === session.id ? ' is-selected' : ''}`} type="button" key={session.id} aria-expanded={selectedId === session.id} onClick={() => { setNotice(''); setSelectedId(session.id) }}>
          <span className="waiter-session-row-heading"><span className="waiter-session-table"><Table2 size={18} aria-hidden="true" />{tableLabel(session)}</span><span className="waiter-session-state">Xidmətdə</span></span>
          <span className="waiter-session-row-meta"><span><Clock3 size={15} aria-hidden="true" />{sessionTime(session.openedAt, session.timeZone)}</span><span><Users size={15} aria-hidden="true" />{session.peopleCount == null ? 'Qonaq sayı qeyd olunmayıb' : `${session.peopleCount} nəfər`}</span></span>
          {session.customerName ? <span className="waiter-session-customer">{session.customerName}</span> : null}
        </button>)}
      </div>
      {selectedId !== null ? <aside className="waiter-session-detail" aria-label="Masa sessiyası detalları">
        <div className="waiter-session-detail-heading"><div><span>MASA SESSİYASI</span><h2>{selected ? tableLabel(selected) : `Sessiya #${selectedId}`}</h2></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Detalı bağla" title="Detalı bağla"><X size={18} /></button></div>
        {detail.isLoading ? <p className="waiter-reservations-muted" role="status">Detal yüklənir...</p> : null}
        {detail.error ? <StatusMessage tone="danger" autoHideMs={false}>{detail.error}</StatusMessage> : null}
        {detail.error ? <Button type="button" variant="secondary" onClick={refreshSessions}>Yenidən yoxla</Button> : null}
        {selected ? <dl className="waiter-session-facts">
          <div><dt><Table2 size={16} aria-hidden="true" />Masa</dt><dd>{tableLabel(selected)} · {selected.tableCapacity} nəfərlik</dd></div>
          <div><dt><Clock3 size={16} aria-hidden="true" />Açılma vaxtı</dt><dd>{sessionTime(selected.openedAt, selected.timeZone)}</dd></div>
          <div><dt><Users size={16} aria-hidden="true" />Qonaq</dt><dd>{selected.customerName || 'Ad qeyd olunmayıb'}{selected.peopleCount == null ? '' : ` · ${selected.peopleCount} nəfər`}</dd></div>
          {selected.reservationId !== null ? <div><dt>Rezervasiya</dt><dd>#{selected.reservationId}</dd></div> : null}
          {selected.mustVacateAt ? <div><dt><CalendarClock size={16} aria-hidden="true" />Masanı təhvil vaxtı</dt><dd>{sessionTime(selected.mustVacateAt, selected.timeZone)}</dd></div> : null}
        </dl> : null}
        {selected ? <ButtonLink to={`/waiter/restaurants/${restaurantId}/sessions/${selected.id}/orders`}>Masa sifarişləri</ButtonLink> : null}
      </aside> : null}
    </div> : null}
    {list.hasData && !list.error ? <PaginationControls ariaLabel="Masa sessiyası səhifələri" pageIndex={list.data.pageIndex} totalPages={list.data.totalPages} hasNextPage={list.data.hasNextPage} hasPreviousPage={list.data.hasPreviousPage} totalCount={list.data.totalCount} pageSize={20} onPageChange={(next) => { setPage(next); setSelectedId(null); setNotice('') }} /> : null}
  </section>
}
