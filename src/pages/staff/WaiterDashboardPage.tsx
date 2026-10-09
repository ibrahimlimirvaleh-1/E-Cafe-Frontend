import { CalendarDays, CalendarX2, CheckCircle2, RefreshCw, Store, Table2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import './waiter-reservations.css'

const emptyPage: PaginatedResponse<ReservationServiceItemResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasNextPage: false, hasPreviousPage: false,
}

export function WaiterDashboardPage() {
  const { user, selectProfile } = useAuth()
  const profiles = useMemo(() => user?.profiles.filter((profile) => profile.roleId === RoleIds.Waiter && profile.isActive !== false) || [], [user])
  const restaurantIds = useMemo(() => [...new Set([
    ...profiles.map((profile) => profile.restaurantId),
    ...(user?.roleId === RoleIds.Waiter && user.restaurantId ? [user.restaurantId] : []),
  ])], [user, profiles])
  const restaurantId = user?.restaurantId && restaurantIds.includes(user.restaurantId) ? user.restaurantId : restaurantIds[0] || ''
  const [date, setDate] = useState(getTodayDateInputValue)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null)

  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh()
    }, 30_000)
    return () => {
      window.removeEventListener('ecafe:notifications-refresh', refresh)
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [])

  const pageKey = `${restaurantId}:${date}:${page}:${reloadKey}`
  const { data: pageResult, error, isLoading } = useAsyncData(
    () => restaurantId ? ecafeApi.reservations.listForService(restaurantId, {
      pageNumber: page, pageSize: 20, reservedDate: date,
    }).then((result) => ({ key: pageKey, page: result })) : Promise.resolve({ key: pageKey, page: emptyPage }),
    { key: '', page: emptyPage },
    [pageKey],
  )
  const data = pageResult.key === pageKey ? pageResult.page : emptyPage
  const listLoading = isLoading || (pageResult.key !== pageKey && !error)
  const selected = data.items.find((item) => item.id === selectedId)
  const actionsKey = selected ? `${restaurantId}:${selected.id}:${selected.statusId}:${selected.arrivedAt || ''}:${reloadKey}` : ''
  const { data: actionsResult, error: actionsError, isLoading: actionsPending } = useAsyncData(
    () => selected && restaurantId
      ? ecafeApi.workflow.actionsStrict({ flowCode: 'reservation', statusId: selected.statusId, restaurantId, entityId: String(selected.id) })
        .then((items) => ({ key: actionsKey, items }))
      : Promise.resolve({ key: actionsKey, items: [] as WorkflowAction[] }),
    { key: '', items: [] as WorkflowAction[] },
    [actionsKey],
  )
  const actions = actionsResult.key === actionsKey ? actionsResult.items : []
  const actionsLoading = Boolean(selected) && (actionsPending || actionsResult.key !== actionsKey) && !actionsError
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

  return <main className="staff-page waiter-reservations-page">
    <PageHeader eyebrow="REZERVASİYALAR" title="Müştəri gəlişi" description="Rezervasiyaların gəliş və masa vəziyyətini idarə edin." />
    <div className="waiter-reservations-filters">
      {restaurantIds.length > 1 ? <label className="waiter-restaurant-filter">Restoran<select value={restaurantId} onChange={(event) => { selectProfile({ restaurantId: event.target.value, roleId: RoleIds.Waiter }); setPage(1); setSelectedId(null) }}>
        {restaurantIds.map((id) => <option key={id} value={id}>{profiles.find((profile) => profile.restaurantId === id)?.restaurantName || `Restoran ${id}`}</option>)}
      </select></label> : <div className="waiter-restaurant-name"><span>Restoran</span><strong><Store size={18} aria-hidden="true" />{profiles.find((profile) => profile.restaurantId === restaurantId)?.restaurantName || 'Restoran rezervasiyaları'}</strong></div>}
      <label className="waiter-date-filter">Rezervasiya tarixi<LocalizedDateInput value={date} onChange={(event) => { setDate(event.target.value); setPage(1); setSelectedId(null) }} /></label>
      <Button type="button" variant="secondary" onClick={() => setReloadKey((value) => value + 1)} title="Siyahını yenilə" aria-label="Siyahını yenilə"><RefreshCw size={18} /></Button>
    </div>
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>Sizə aid restoran tapılmadı.</StatusMessage> : null}
    {listLoading ? <p className="waiter-reservations-muted">Rezervasiyalar yüklənir...</p> : null}
    {!listLoading && !error && restaurantId && data.items.length === 0 ? <div className="waiter-reservations-empty" role="status">
      <span className="waiter-reservations-empty-icon"><CalendarX2 size={22} aria-hidden="true" /></span>
      <div><strong>Aktiv rezervasiya yoxdur</strong><p>Seçilən tarix üçün gəlişi idarə ediləcək rezervasiya tapılmadı.</p></div>
    </div> : null}
    <section className="waiter-reservations-list" aria-label="Servis rezervasiyaları">
      {!listLoading && !error && data.items.map((item) => {
        const isSelected = selectedId === item.id
        const startsAt = new Date(item.reservedAt).getTime()
        const deadlineAt = new Date(item.noShowDeadlineAt).getTime()
        const state = item.seatedAt ? 'Masaya əyləşib' : item.arrivedAt ? 'Gəlib, masa gözləyir' : now < startsAt ? 'Vaxtı çatmayıb' : now >= deadlineAt ? 'Gəliş müddəti bitib' : 'Gəliş gözlənilir'
        return <article className={`waiter-reservation${isSelected ? ' is-selected' : ''}`} key={item.id}>
          <div className="waiter-reservation-top"><div><small>REZERVASİYA #{item.id}</small><h2>{item.customerName}</h2></div><span className={`waiter-reservation-state${item.seatedAt ? ' is-seated' : item.arrivedAt ? ' is-arrived' : ''}`}>{state}</span></div>
          <div className="waiter-reservation-meta"><span><Table2 size={17} />{item.tableName}</span><span><CalendarDays size={17} />{formatReservationDateTime(item.reservedAt, item.timeZone || 'Asia/Baku')}</span><span><Users size={17} />{item.peopleCount} nəfər</span></div>
          {isSelected ? <div className="waiter-reservation-detail">
            <p>Gəliş üçün son vaxt: {formatReservationDateTime(item.noShowDeadlineAt, item.timeZone || 'Asia/Baku')}</p>
            {item.mustVacateAt ? <p>Masanı təhvil vaxtı: {formatReservationDateTime(item.mustVacateAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {item.arrivedAt ? <p>Gəliş qeyd edildi: {formatReservationDateTime(item.arrivedAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {actionsLoading ? <span className="waiter-reservations-muted">Əməliyyatlar yoxlanılır...</span> : null}
            {actionsError ? <StatusMessage tone="danger" autoHideMs={false}>{actionsError}</StatusMessage> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && checkIn ? <Button type="button" disabled={busy} onClick={() => setPendingAction(checkIn)}><Table2 size={17} />Masaya əyləşdir</Button> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !item.arrivedAt && markArrived ? <Button type="button" variant="secondary" disabled={busy} onClick={() => void execute(markArrived)}><CheckCircle2 size={17} />Gəlişi qeyd et</Button> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !markArrived && !checkIn ? <span className="waiter-reservations-muted">{now < startsAt ? 'Rezervasiya vaxtı hələ çatmayıb.' : !item.arrivedAt && now >= deadlineAt ? 'Gəliş müddəti bitib. No-show statusu yenilənəcək.' : 'Hazırda icra edilə bilən əməliyyat yoxdur.'}</span> : null}
            {actionError ? <StatusMessage tone="danger">{actionError}</StatusMessage> : null}
            {actionMessage ? <StatusMessage tone="success">{actionMessage}</StatusMessage> : null}
          </div> : null}
          <Button type="button" variant="secondary" className="waiter-reservation-select" aria-expanded={isSelected} onClick={() => { setSelectedId(isSelected ? null : item.id); setActionError(''); setActionMessage('') }}>{isSelected ? 'Bağla' : 'İdarə et'}</Button>
        </article>
      })}
    </section>
    <PaginationControls ariaLabel="Rezervasiya səhifələri" hasNextPage={data.hasNextPage} hasPreviousPage={data.hasPreviousPage} pageIndex={data.pageIndex} totalPages={data.totalPages} onPageChange={(next) => { setPage(next); setSelectedId(null) }} />
    <ReservationReasonDialog isOpen={Boolean(pendingAction)} title="Müştərini masaya əyləşdirirsiniz?" description="Bu əməliyyat masa sessiyasını açacaq. Müştərinin həqiqətən masaya əyləşdiyini yoxlayın." confirmLabel="Masaya əyləşdir" confirmVariant="primary" isSubmitting={busy} error={pendingAction ? actionError : ''} requireReason={false} showReason={false} onClose={() => setPendingAction(null)} onConfirm={() => { if (pendingAction) void execute(pendingAction) }} />
  </main>
}
