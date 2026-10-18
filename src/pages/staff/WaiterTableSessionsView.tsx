import { i18n } from '../../shared/i18n/i18n'
import { CalendarClock, Clock3, RefreshCw, Store, Table2, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SessionCloseReviewActions } from '../../features/reservations/SessionCloseReviewActions'
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
  targetSessionId: number | null
  selectionKey: string
}

// Masa adı verilməyəndə nömrə ilə oxunaqlı ad göstərir.
function tableLabel(session: WaiterTableSessionResponse) {
  return session.tableName?.trim() || `Masa-${session.tableNo}`
}

// UTC vaxtını restoranın saat qurşağına görə göstərir.
function sessionTime(value: string, timeZone: string) {
  return formatReservationDateTime(value, timeZone || 'Asia/Baku')
}

export function WaiterTableSessionsView({ restaurantId, restaurantName, restaurantOptions, onRestaurantChange, reloadKey, targetSessionId, selectionKey }: Props) {
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(targetSessionId)
  const [listRevision, setListRevision] = useState(0)
  const [detailRevision, setDetailRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<'warning' | 'success'>('warning')
  useEffect(() => {
    if (targetSessionId !== null) setSelectedId(targetSessionId)
  }, [targetSessionId, selectionKey])
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
    setNoticeTone('warning')
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

  return <section className="waiter-sessions-view" aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.xidmet_etdiyim_masalar_bcd05b')}>
    <div className="waiter-sessions-toolbar">
      {restaurantOptions.length > 1 ? <label className="waiter-sessions-restaurant">{i18n.t('ui.pages.staff.waiter_table_sessions_view.restoran_c4df56')}
        <select value={restaurantId} onChange={(event) => onRestaurantChange(event.target.value)}>
          {restaurantOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label> : <div className="waiter-sessions-restaurant-name"><span>{i18n.t('ui.pages.staff.waiter_table_sessions_view.restoran_c4df56')}</span><strong><Store size={18} aria-hidden="true" />{restaurantName}</strong></div>}
      <Button type="button" variant="secondary" onClick={refreshSessions} title={i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyalarini_yenile_305fb7')} aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyalarini_yenile_305fb7')}><RefreshCw size={18} /></Button>
    </div>
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_table_sessions_view.size_aid_restoran_tapilmadi_3fdf18')}</StatusMessage> : null}
    {list.error ? <StatusMessage tone="danger" autoHideMs={false}>{list.error}</StatusMessage> : null}
    {notice ? <StatusMessage tone={noticeTone} autoHideMs={false}>{notice}</StatusMessage> : null}
    <div className="waiter-sessions-summary"><strong>{list.hasData && !list.error ? `${list.data.totalCount} açıq masa` :i18n.t('ui.pages.staff.waiter_table_sessions_view.aciq_masalar_94a704')}</strong>{list.isRefreshing ? <span role="status">{i18n.t('ui.pages.staff.waiter_table_sessions_view.yenilenir_283de5')}</span> : null}</div>
    {list.isLoading ? <p className="waiter-reservations-muted" role="status">{i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyalari_yuklenir_e3e0bd')}</p> : null}
    {!list.isLoading && !list.error && list.hasData && sessions.length === 0 ? <div className="waiter-reservations-empty" role="status">
      <span className="waiter-reservations-empty-icon"><Table2 size={22} aria-hidden="true" /></span>
      <div><strong>{i18n.t('ui.pages.staff.waiter_table_sessions_view.aciq_masa_sessiyasi_yoxdur_2d0a73')}</strong><p>{i18n.t('ui.pages.staff.waiter_table_sessions_view.hazirda_size_teyin_edilmis_aciq_masa_t_18df8e')}</p></div>
    </div> : null}
    {list.hasData && (sessions.length > 0 || selectedId !== null) ? <div className="waiter-sessions-layout">
      <div className="waiter-sessions-list" aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.aciq_masa_sessiyalari_8304f2')}>
        {sessions.map((session) => <button className={`waiter-session-row${selectedId === session.id ? ' is-selected' : ''}`} type="button" key={session.id} aria-expanded={selectedId === session.id} onClick={() => { setNotice(''); setSelectedId(session.id) }}>
          <span className="waiter-session-row-heading"><span className="waiter-session-table"><Table2 size={18} aria-hidden="true" />{tableLabel(session)}</span><span className={`waiter-session-state${session.requiresCloseReview ? ' is-review' : ''}`}>{session.requiresCloseReview ?i18n.t('ui.pages.staff.waiter_table_sessions_view.baglanmasi_yoxlanmalidir_87b96f') :i18n.t('ui.pages.staff.waiter_table_sessions_view.xidmetde_3015e9')}</span></span>
          <span className="waiter-session-row-meta"><span><Clock3 size={15} aria-hidden="true" />{sessionTime(session.openedAt, session.timeZone)}</span><span><Users size={15} aria-hidden="true" />{session.peopleCount == null ?i18n.t('ui.pages.staff.waiter_table_sessions_view.qonaq_sayi_qeyd_olunmayib_98c6e4') : `${session.peopleCount} nəfər`}</span></span>
          {session.customerName ? <span className="waiter-session-customer">{session.customerName}</span> : null}
        </button>)}
      </div>
      {selectedId !== null ? <aside className="waiter-session-detail" aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyasi_detallari_f440fb')}>
        <div className="waiter-session-detail-heading"><div><span>{i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyasi_dc7521')}</span><h2>{selected ? tableLabel(selected) : `Sessiya #${selectedId}`}</h2></div><button type="button" onClick={() => setSelectedId(null)} aria-label={i18n.t('ui.pages.staff.waiter_table_sessions_view.detali_bagla_1b404b')} title={i18n.t('ui.pages.staff.waiter_table_sessions_view.detali_bagla_1b404b')}><X size={18} /></button></div>
        {detail.isLoading ? <p className="waiter-reservations-muted" role="status">{i18n.t('ui.pages.staff.waiter_table_sessions_view.detal_yuklenir_788fbc')}</p> : null}
        {detail.error ? <StatusMessage tone="danger" autoHideMs={false}>{detail.error}</StatusMessage> : null}
        {detail.error ? <Button type="button" variant="secondary" onClick={refreshSessions}>{i18n.t('ui.pages.staff.waiter_table_sessions_view.yeniden_yoxla_9c69a3')}</Button> : null}
        {selected ? <dl className="waiter-session-facts">
          <div><dt><Table2 size={16} aria-hidden="true" />{i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_058c4c')}</dt><dd>{tableLabel(selected)} · {selected.tableCapacity} {i18n.t('ui.pages.staff.waiter_table_sessions_view.neferlik_2dc0b2')}</dd></div>
          <div><dt><Clock3 size={16} aria-hidden="true" />{i18n.t('ui.pages.staff.waiter_table_sessions_view.acilma_vaxti_97fc61')}</dt><dd>{sessionTime(selected.openedAt, selected.timeZone)}</dd></div>
          <div><dt><Users size={16} aria-hidden="true" />{i18n.t('ui.pages.staff.waiter_table_sessions_view.qonaq_5d6bb8')}</dt><dd>{selected.customerName || 'Ad qeyd olunmayıb'}{selected.peopleCount == null ? '' : ` · ${selected.peopleCount} nəfər`}</dd></div>
          {selected.reservationId !== null ? <div><dt>{i18n.t('ui.pages.staff.waiter_table_sessions_view.rezervasiya_9cf147')}</dt><dd>#{selected.reservationId}</dd></div> : null}
          {selected.mustVacateAt ? <div><dt><CalendarClock size={16} aria-hidden="true" />{i18n.t('ui.pages.staff.waiter_table_sessions_view.masani_tehvil_vaxti_4e00d4')}</dt><dd>{sessionTime(selected.mustVacateAt, selected.timeZone)}</dd></div> : null}
        </dl> : null}
        {selected ? <SessionCloseReviewActions restaurantId={restaurantId} reservationId={selected.reservationId} sessionId={selected.id} canComplete={selected.reservationId !== null} completeAs="waiter" canContinue={false} requiresReview={selected.requiresCloseReview} reviewDueAt={selected.closeReviewDueAt} reviewConfirmedAt={selected.closeReviewConfirmedAt} timeZone={selected.timeZone} onChanged={(message) => { setSelectedId(null); setNotice(message); setNoticeTone('success'); setListRevision((value) => value + 1) }} /> : null}
        {selected ? <ButtonLink to={`/waiter/restaurants/${restaurantId}/sessions/${selected.id}/orders`}>{i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sifarisleri_a21dba')}</ButtonLink> : null}
      </aside> : null}
    </div> : null}
    {list.hasData && !list.error ? <PaginationControls ariaLabel={i18n.t('ui.pages.staff.waiter_table_sessions_view.masa_sessiyasi_sehifeleri_a19e6e')} pageIndex={list.data.pageIndex} totalPages={list.data.totalPages} hasNextPage={list.data.hasNextPage} hasPreviousPage={list.data.hasPreviousPage} totalCount={list.data.totalCount} pageSize={20} onPageChange={(next) => { setPage(next); setSelectedId(null); setNotice('') }} /> : null}
  </section>
}
