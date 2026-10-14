import { CalendarDays, CalendarX2, CheckCircle2, RefreshCw, Store, Table2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { WorkflowAction } from '../../entities/types'
import { ReservationReasonDialog } from '../../features/reservations/ReservationReasonDialog'
import { ecafeApi, type ReservationServiceItemResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime, getTodayDateInputValue } from '../../shared/lib/dateFormatting'
import { Button } from '../../shared/ui/Button'
import { LocalizedDateInput } from '../../shared/ui/LocalizedDateInput'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { WaiterTableSessionsView } from './WaiterTableSessionsView'
import './waiter-reservations.css'

const emptyPage: PaginatedResponse<ReservationServiceItemResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasNextPage: false, hasPreviousPage: false,
}

export function WaiterDashboardPage() {
  const { user, selectProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const showTables = searchParams.get('view') === 'tables'
  const waitingQuery = searchParams.get('waitingOnly') === 'true'
  const targetReservationId = Number(searchParams.get('reservationId'))
  const profiles = useMemo(() => user?.profiles.filter((profile) => profile.roleId === RoleIds.Waiter && profile.isActive !== false) || [], [user])
  const restaurantIds = useMemo(() => [...new Set([
    ...profiles.map((profile) => profile.restaurantId),
    ...(user?.roleId === RoleIds.Waiter && user.restaurantId ? [user.restaurantId] : []),
  ])], [user, profiles])
  const restaurantId = user?.restaurantId && restaurantIds.includes(user.restaurantId) ? user.restaurantId : restaurantIds[0] || ''
  const [date, setDate] = useState(() => waitingQuery ? '' : getTodayDateInputValue())
  const [waitingOnly, setWaitingOnly] = useState(waitingQuery)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(Number.isInteger(targetReservationId) && targetReservationId > 0 ? targetReservationId : null)
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null)

  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, 30_000)
    return () => {
      window.removeEventListener('ecafe:notifications-refresh', refresh)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!waitingQuery) return
    setWaitingOnly(true)
    setDate('')
    setPage(1)
    if (Number.isInteger(targetReservationId) && targetReservationId > 0) setSelectedId(targetReservationId)
  }, [waitingQuery, targetReservationId])

  const pageKey = showTables ? 'inactive' : `${restaurantId}:${date}:${waitingOnly}:${page}`
  const { data: pageResult, error } = useAsyncData(
    () => !showTables && restaurantId ? ecafeApi.reservations.listForService(restaurantId, {
      pageNumber: page, pageSize: 20, reservedDate: date || undefined, waitingOnly,
    }).then((result) => ({ key: pageKey, page: result })) : Promise.resolve({ key: pageKey, page: emptyPage }),
    { key: '', page: emptyPage },
    [pageKey, reloadKey],
  )
  const data = pageResult.key === pageKey ? pageResult.page : emptyPage
  const listLoading = pageResult.key !== pageKey && !error
  const selected = data.items.find((item) => item.id === selectedId)
  const actionsKey = selected ? `${restaurantId}:${selected.id}:${selected.statusId}:${selected.arrivedAt || ''}` : ''
  const { data: actionsResult, error: actionsError } = useAsyncData(
    () => selected && restaurantId
      ? ecafeApi.workflow.actionsStrict({ flowCode: 'reservation', statusId: selected.statusId, restaurantId, entityId: String(selected.id) })
        .then((items) => ({ key: actionsKey, items }))
      : Promise.resolve({ key: actionsKey, items: [] as WorkflowAction[] }),
    { key: '', items: [] as WorkflowAction[] },
    [actionsKey, reloadKey],
  )
  const actions = actionsResult.key === actionsKey ? actionsResult.items : []
  const actionsLoading = Boolean(selected) && actionsResult.key !== actionsKey && !actionsError
  const now = Date.now()
  const markArrived = actions.find((action) => action.code === 'markArrived')
  const checkIn = actions.find((action) => action.code === 'checkIn')

  async function execute(action: WorkflowAction) {
    setBusy(true)
    setActionError('')
    setActionMessage('')
    try {
      await ecafeApi.workflow.executeAction({ action })
      setActionMessage(action.code === 'markArrived' ? 'Müştərinin gəlişi qeyd edildi.' : 'Müştəri masaya əyləşdirildi və masa açıldı.')
      setPendingAction(null)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (caught) {
      setActionError(normalizeCaughtApiError(caught, 'Əməliyyat icra olunmadı.').message)
    } finally {
      setBusy(false)
    }
  }

  // Seçilmiş görünüşü URL-də saxlayır ki, səhifə yenilənəndə eyni bölmə açılsın.
  function changeView(view: 'arrivals' | 'tables') {
    const next = new URLSearchParams(searchParams)
    if (view === 'tables') next.set('view', 'tables')
    else next.delete('view')
    setSearchParams(next)
  }

  return <main className="staff-page waiter-reservations-page">
    <PageHeader eyebrow="OFİSİANT PANELİ" title={showTables ? 'Xidmət etdiyim masalar' : 'Müştəri gəlişi'} description={showTables ? 'Sizə təyin edilmiş açıq masa sessiyalarını izləyin.' : 'Rezervasiyaların gəliş və masa vəziyyətini idarə edin.'} />
    <div className="waiter-main-modes" role="group" aria-label="Ofisiant paneli görünüşü">
      <button type="button" className={!showTables ? 'is-active' : ''} aria-pressed={!showTables} onClick={() => changeView('arrivals')}>Müştəri gəlişi</button>
      <button type="button" className={showTables ? 'is-active' : ''} aria-pressed={showTables} onClick={() => changeView('tables')}>Xidmət etdiyim masalar</button>
    </div>
    {showTables ? <WaiterTableSessionsView key={restaurantId} restaurantId={restaurantId} restaurantName={profiles.find((profile) => profile.restaurantId === restaurantId)?.restaurantName || 'Restoran'} restaurantOptions={restaurantIds.map((id) => ({ id, name: profiles.find((profile) => profile.restaurantId === id)?.restaurantName || `Restoran ${id}` }))} onRestaurantChange={(id) => selectProfile({ restaurantId: id, roleId: RoleIds.Waiter })} reloadKey={reloadKey} /> : <>
    <div className="waiter-reservations-filters">
      {restaurantIds.length > 1 ? <label className="waiter-restaurant-filter">Restoran<select value={restaurantId} onChange={(event) => { selectProfile({ restaurantId: event.target.value, roleId: RoleIds.Waiter }); setPage(1); setSelectedId(null) }}>
        {restaurantIds.map((id) => <option key={id} value={id}>{profiles.find((profile) => profile.restaurantId === id)?.restaurantName || `Restoran ${id}`}</option>)}
      </select></label> : <div className="waiter-restaurant-name"><span>Restoran</span><strong><Store size={18} aria-hidden="true" />{profiles.find((profile) => profile.restaurantId === restaurantId)?.restaurantName || 'Restoran rezervasiyaları'}</strong></div>}
      <div className="waiter-date-filter"><span>Rezervasiya tarixi</span><div className="waiter-date-control"><LocalizedDateInput aria-label="Rezervasiya tarixi" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); setSelectedId(null) }} />{date ? <button aria-label="Tarix filtrini təmizlə" onClick={() => { setDate(''); setPage(1); setSelectedId(null) }} title="Tarix filtrini təmizlə" type="button"><X size={17} /></button> : null}</div></div>
      <Button type="button" variant="secondary" onClick={() => setReloadKey((value) => value + 1)} title="Siyahını yenilə" aria-label="Siyahını yenilə"><RefreshCw size={18} /></Button>
    </div>
    <div className="waiter-reservation-modes" role="group" aria-label="Rezervasiya görünüşü">
      <button aria-pressed={!waitingOnly} className={!waitingOnly ? 'is-active' : ''} onClick={() => { setWaitingOnly(false); setDate(getTodayDateInputValue()); setPage(1); setSelectedId(null) }} type="button">Bütün rezervasiyalar</button>
      <button aria-pressed={waitingOnly} className={waitingOnly ? 'is-active' : ''} onClick={() => { setWaitingOnly(true); setDate(''); setPage(1); setSelectedId(null) }} type="button">Gəlişi yoxlanacaq</button>
    </div>
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>Sizə aid restoran tapılmadı.</StatusMessage> : null}
    {listLoading ? <p className="waiter-reservations-muted">Rezervasiyalar yüklənir...</p> : null}
    {!listLoading && !error && restaurantId && data.items.length === 0 ? <div className="waiter-reservations-empty" role="status">
      <span className="waiter-reservations-empty-icon"><CalendarX2 size={22} aria-hidden="true" /></span>
      <div><strong>{waitingOnly ? 'Yoxlanacaq gəliş yoxdur' : 'Aktiv rezervasiya yoxdur'}</strong><p>{waitingOnly ? 'Hazırda gəlib masaya əyləşməmiş qonaq tapılmadı.' : 'Seçilən tarix üçün gəlişi idarə ediləcək rezervasiya tapılmadı.'}</p></div>
    </div> : null}
    <section className="waiter-reservations-list" aria-label="Servis rezervasiyaları">
      {!listLoading && !error && data.items.map((item) => {
        const isSelected = selectedId === item.id
        const startsAt = new Date(item.reservedAt).getTime()
        const deadlineAt = new Date(item.noShowDeadlineAt).getTime()
        const state = item.seatedAt ? 'Masaya əyləşib' : item.requiresReceptionReview ? 'Nəticə yoxlanmalıdır' : item.isWaitingOverdue ? 'Masa gözləyir · gecikir' : item.arrivedAt ? 'Gəlib, masa gözləyir' : now >= deadlineAt ? 'Gəliş müddəti bitib' : 'Gəliş gözlənilir'
        return <article className={`waiter-reservation${isSelected ? ' is-selected' : ''}`} key={item.id}>
          <div className="waiter-reservation-top"><div><small>REZERVASİYA #{item.id}</small><h2>{item.customerName}</h2></div><span className={`waiter-reservation-state${item.requiresReceptionReview ? ' is-review' : item.seatedAt ? ' is-seated' : item.isWaitingOverdue ? ' is-overdue' : item.arrivedAt ? ' is-arrived' : ''}`}>{state}</span></div>
          <div className="waiter-reservation-meta"><span><Table2 size={17} />{item.tableName}</span><span><CalendarDays size={17} />{formatReservationDateTime(item.reservedAt, item.timeZone || 'Asia/Baku')}</span><span><Users size={17} />{item.peopleCount} nəfər</span></div>
          {item.waitingSinceAt && !item.requiresReceptionReview ? <div className="waiter-reservation-waiting"><span>Gözləmə <strong>{item.waitingMinutes} dəq</strong></span><span>Servis gecikməsi <strong>{item.serviceDelayMinutes} dəq</strong></span></div> : null}
          {isSelected ? <div className="waiter-reservation-detail">
            {!item.arrivedAt ? <p>Gəliş üçün son vaxt: {formatReservationDateTime(item.noShowDeadlineAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {item.mustVacateAt ? <p>Masanı təhvil vaxtı: {formatReservationDateTime(item.mustVacateAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {item.arrivedAt ? <p>Gəliş qeyd edildi: {formatReservationDateTime(item.arrivedAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {item.requiresReceptionReview ? <p className="waiter-reservation-review-note">Xidmət müddəti bitib. Nəticəni restoran menecerinə bildirin; rezervasiya avtomatik ləğv edilməyib.</p> : null}
            {actionsLoading ? <span className="waiter-reservations-muted">Əməliyyatlar yoxlanılır...</span> : null}
            {actionsError ? <StatusMessage tone="danger" autoHideMs={false}>{actionsError}</StatusMessage> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !item.requiresReceptionReview && checkIn ? <Button type="button" disabled={busy} onClick={() => setPendingAction(checkIn)}><Table2 size={17} />Masaya əyləşdir</Button> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !item.arrivedAt && !item.requiresReceptionReview && markArrived ? <Button type="button" variant="secondary" disabled={busy} onClick={() => void execute(markArrived)}><CheckCircle2 size={17} />Gəlişi qeyd et</Button> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !item.requiresReceptionReview && !markArrived && !checkIn ? <span className="waiter-reservations-muted">{now < startsAt ? 'Gəliş əməliyyatı hazırda əlçatan deyil.' : !item.arrivedAt && now >= deadlineAt ? 'Gəliş müddəti bitib. No-show statusu yenilənəcək.' : 'Hazırda icra edilə bilən əməliyyat yoxdur.'}</span> : null}
            {actionError ? <StatusMessage tone="danger">{actionError}</StatusMessage> : null}
            {actionMessage ? <StatusMessage tone="success">{actionMessage}</StatusMessage> : null}
          </div> : null}
          <Button type="button" variant="secondary" className="waiter-reservation-select" aria-expanded={isSelected} onClick={() => { setSelectedId(isSelected ? null : item.id); setActionError(''); setActionMessage('') }}>{isSelected ? 'Bağla' : 'İdarə et'}</Button>
        </article>
      })}
    </section>
    <PaginationControls ariaLabel="Rezervasiya səhifələri" hasNextPage={data.hasNextPage} hasPreviousPage={data.hasPreviousPage} pageIndex={data.pageIndex} totalPages={data.totalPages} onPageChange={(next) => { setPage(next); setSelectedId(null) }} />
    <ReservationReasonDialog isOpen={Boolean(pendingAction)} title="Müştərini masaya əyləşdirirsiniz?" description="Bu əməliyyat gəlişi qeyd edəcək və masa sessiyasını açacaq. Masanın hazır olduğunu yoxlayın." confirmLabel="Masaya əyləşdir" confirmVariant="primary" isSubmitting={busy} error={pendingAction ? actionError : ''} requireReason={false} showReason={false} onClose={() => setPendingAction(null)} onConfirm={() => { if (pendingAction) void execute(pendingAction) }} />
    </>}
  </main>
}
