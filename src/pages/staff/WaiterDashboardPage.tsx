import { CalendarDays, CheckCircle2, RefreshCw, Table2, Users } from 'lucide-react'
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
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './waiter-reservations.css'

const emptyPage: PaginatedResponse<ReservationServiceItemResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasNextPage: false, hasPreviousPage: false,
}

export function WaiterDashboardPage() {
  const { user } = useAuth()
  const profiles = useMemo(() => user?.profiles.filter((profile) => profile.roleId === RoleIds.Waiter && profile.isActive !== false) || [], [user])
  const restaurantIds = useMemo(() => [...new Set([
    ...profiles.map((profile) => profile.restaurantId),
    ...(user?.roleId === RoleIds.Waiter && user.restaurantId ? [user.restaurantId] : []),
  ])], [user, profiles])
  const [restaurantSelection, setRestaurantSelection] = useState('')
  const restaurantId = restaurantIds.includes(restaurantSelection) ? restaurantSelection : restaurantIds[0] || ''
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
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])

  const { data, error, isLoading } = useAsyncData(
    () => restaurantId ? ecafeApi.reservations.listForService(restaurantId, {
      pageNumber: page, pageSize: 20, reservedDate: date,
    }) : Promise.resolve(emptyPage),
    emptyPage,
    [restaurantId, page, date, reloadKey],
  )
  const selected = data.items.find((item) => item.id === selectedId)
  const { data: actions, isLoading: actionsLoading } = useAsyncData<WorkflowAction[]>(
    () => selected && restaurantId
      ? ecafeApi.workflow.actions({ flowCode: 'reservation', statusId: selected.statusId, restaurantId, entityId: String(selected.id) })
      : Promise.resolve([]),
    [],
    [restaurantId, selected?.id, selected?.statusId, selected?.arrivedAt, reloadKey],
  )
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
      setReloadKey((value) => value + 1)
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
    } catch (caught) {
      setActionError(normalizeCaughtApiError(caught, 'Əməliyyat icra olunmadı.').message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="staff-page waiter-reservations-page">
    <PageHeader eyebrow="REZERVASİYALAR" title="Müştəri gəlişi" description="Gəlişi qeyd edin, sonra qonaqları masaya əyləşdirin." />
    <div className="waiter-reservations-filters">
      {restaurantIds.length > 1 ? <label>Restoran<select value={restaurantId} onChange={(event) => { setRestaurantSelection(event.target.value); setPage(1); setSelectedId(null) }}>
        {restaurantIds.map((id) => <option key={id} value={id}>{profiles.find((profile) => profile.restaurantId === id)?.restaurantName || `Restoran ${id}`}</option>)}
      </select></label> : <strong className="waiter-restaurant-name">{profiles.find((profile) => profile.restaurantId === restaurantId)?.restaurantName || 'Restoran rezervasiyaları'}</strong>}
      <label>Rezervasiya tarixi<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); setSelectedId(null) }} /></label>
      <Button type="button" variant="secondary" onClick={() => setReloadKey((value) => value + 1)} title="Siyahını yenilə" aria-label="Siyahını yenilə"><RefreshCw size={18} /></Button>
    </div>
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>Sizə aid restoran tapılmadı.</StatusMessage> : null}
    {isLoading ? <p className="waiter-reservations-muted">Rezervasiyalar yüklənir...</p> : null}
    {!isLoading && !error && restaurantId && data.items.length === 0 ? <p className="waiter-reservations-empty">Seçilən tarix üçün aktiv rezervasiya yoxdur.</p> : null}
    <section className="waiter-reservations-list" aria-label="Servis rezervasiyaları">
      {!isLoading && !error && data.items.map((item) => {
        const isSelected = selectedId === item.id
        const state = item.seatedAt ? 'Masaya əyləşib' : item.arrivedAt ? 'Gəlib, masa gözləyir' : 'Gəliş gözlənilir'
        return <article className={`waiter-reservation${isSelected ? ' is-selected' : ''}`} key={item.id}>
          <div className="waiter-reservation-top"><div><small>REZERVASİYA #{item.id}</small><h2>{item.customerName}</h2></div><span className={`waiter-reservation-state${item.seatedAt ? ' is-seated' : item.arrivedAt ? ' is-arrived' : ''}`}>{state}</span></div>
          <div className="waiter-reservation-meta"><span><Table2 size={17} />{item.tableName}</span><span><CalendarDays size={17} />{formatReservationDateTime(item.reservedAt, 'Asia/Baku')}</span><span><Users size={17} />{item.peopleCount} nəfər</span></div>
          {isSelected ? <div className="waiter-reservation-detail">
            <p>Gəliş üçün son vaxt: {formatReservationDateTime(item.noShowDeadlineAt, 'Asia/Baku')}</p>
            {item.mustVacateAt ? <p>Masanı təhvil vaxtı: {formatReservationDateTime(item.mustVacateAt, 'Asia/Baku')}</p> : null}
            {item.arrivedAt ? <p>Gəliş qeyd edildi: {formatReservationDateTime(item.arrivedAt, 'Asia/Baku')}</p> : null}
            {actionsLoading ? <span className="waiter-reservations-muted">Əməliyyatlar yoxlanılır...</span> : null}
            {!actionsLoading && !item.seatedAt && !item.arrivedAt && markArrived ? <Button type="button" disabled={busy} onClick={() => void execute(markArrived)}><CheckCircle2 size={17} />Gəlişi qeyd et</Button> : null}
            {!actionsLoading && !item.seatedAt && item.arrivedAt && checkIn ? <Button type="button" disabled={busy} onClick={() => setPendingAction(checkIn)}><Table2 size={17} />Masaya əyləşdir</Button> : null}
            {!actionsLoading && !item.seatedAt && !markArrived && !(item.arrivedAt && checkIn) ? <span className="waiter-reservations-muted">Hazırda icra edilə bilən əməliyyat yoxdur.</span> : null}
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
