import { i18n } from '../../shared/i18n/i18n'
import { CalendarDays, CalendarX2, CheckCircle2, RefreshCw, Store, Table2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { WorkflowAction } from '../../entities/types'
import { ReservationReasonDialog } from '../../features/reservations/ReservationReasonDialog'
import { SessionCloseReviewActions } from '../../features/reservations/SessionCloseReviewActions'
import { ecafeApi, type ReservationServiceItemResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime, getTodayDateInputValue } from '../../shared/lib/dateFormatting'
import { Button, ButtonLink } from '../../shared/ui/Button'
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
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const showTables = searchParams.get('view') === 'tables'
  const waitingQuery = searchParams.get('waitingOnly') === 'true'
  const targetReservationId = Number(searchParams.get('reservationId'))
  const requestedRestaurantId = searchParams.get('restaurantId') || ''
  const requestedSessionId = Number(searchParams.get('tableSessionId'))
  const profiles = useMemo(() => user?.profiles.filter((profile) => profile.roleId === RoleIds.Waiter && profile.isActive !== false) || [], [user])
  const restaurantIds = useMemo(() => [...new Set([
    ...profiles.map((profile) => profile.restaurantId),
    ...(user?.roleId === RoleIds.Waiter && user.restaurantId ? [user.restaurantId] : []),
  ])], [user, profiles])
  const restaurantId = user?.restaurantId && restaurantIds.includes(user.restaurantId) ? user.restaurantId : restaurantIds[0] || ''
  const targetSessionId = (!requestedRestaurantId || requestedRestaurantId === restaurantId) &&
    Number.isSafeInteger(requestedSessionId) && requestedSessionId > 0 ? requestedSessionId : null
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
    if (!showTables || !requestedRestaurantId || requestedRestaurantId === restaurantId) return
    if (profiles.some((profile) => profile.restaurantId === requestedRestaurantId)) {
      selectProfile({ restaurantId: requestedRestaurantId, roleId: RoleIds.Waiter })
    }
  }, [showTables, requestedRestaurantId, restaurantId, profiles, selectProfile])

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

  return <main className="staff-page waiter-reservations-page">
    <PageHeader eyebrow={i18n.t('ui.pages.staff.waiter_dashboard_page.ofisiant_paneli_319b18')} title={showTables ?i18n.t('ui.pages.staff.waiter_dashboard_page.xidmet_etdiyim_masalar_bcd05b') :i18n.t('ui.pages.staff.waiter_dashboard_page.musteri_gelisi_59cf27')} description={showTables ?i18n.t('ui.pages.staff.waiter_dashboard_page.size_teyin_edilmis_aciq_masa_sessiyala_2d3d83') :i18n.t('ui.pages.staff.waiter_dashboard_page.rezervasiyalarin_gelis_ve_masa_veziyye_3cb3a0')} />
    {showTables ? <WaiterTableSessionsView key={restaurantId} restaurantId={restaurantId} restaurantName={profiles.find((profile) => profile.restaurantId === restaurantId)?.restaurantName || 'Restoran'} restaurantOptions={restaurantIds.map((id) => ({ id, name: profiles.find((profile) => profile.restaurantId === id)?.restaurantName || `Restoran ${id}` }))} onRestaurantChange={(id) => selectProfile({ restaurantId: id, roleId: RoleIds.Waiter })} reloadKey={reloadKey} targetSessionId={targetSessionId} selectionKey={location.key} /> : <>
    <div className="waiter-reservations-filters">
      {restaurantIds.length > 1 ? <label className="waiter-restaurant-filter">{i18n.t('ui.pages.staff.waiter_dashboard_page.restoran_c4df56')}<select value={restaurantId} onChange={(event) => { selectProfile({ restaurantId: event.target.value, roleId: RoleIds.Waiter }); setPage(1); setSelectedId(null) }}>
        {restaurantIds.map((id) => <option key={id} value={id}>{profiles.find((profile) => profile.restaurantId === id)?.restaurantName || `Restoran ${id}`}</option>)}
      </select></label> : <div className="waiter-restaurant-name"><span>{i18n.t('ui.pages.staff.waiter_dashboard_page.restoran_c4df56')}</span><strong><Store size={18} aria-hidden="true" />{profiles.find((profile) => profile.restaurantId === restaurantId)?.restaurantName || 'Restoran rezervasiyaları'}</strong></div>}
      <div className="waiter-date-filter"><span>{i18n.t('ui.pages.staff.waiter_dashboard_page.rezervasiya_tarixi_35eb44')}</span><div className="waiter-date-control"><LocalizedDateInput aria-label={i18n.t('ui.pages.staff.waiter_dashboard_page.rezervasiya_tarixi_35eb44')} value={date} onChange={(event) => { setDate(event.target.value); setPage(1); setSelectedId(null) }} />{date ? <button aria-label={i18n.t('ui.pages.staff.waiter_dashboard_page.tarix_filtrini_temizle_0e58b1')} onClick={() => { setDate(''); setPage(1); setSelectedId(null) }} title={i18n.t('ui.pages.staff.waiter_dashboard_page.tarix_filtrini_temizle_0e58b1')} type="button"><X size={17} /></button> : null}</div></div>
      <Button type="button" variant="secondary" onClick={() => setReloadKey((value) => value + 1)} title={i18n.t('ui.pages.staff.waiter_dashboard_page.siyahini_yenile_98a422')} aria-label={i18n.t('ui.pages.staff.waiter_dashboard_page.siyahini_yenile_98a422')}><RefreshCw size={18} /></Button>
    </div>
    <div className="waiter-reservation-modes" role="group" aria-label={i18n.t('ui.pages.staff.waiter_dashboard_page.rezervasiya_gorunusu_6a9376')}>
      <button aria-pressed={!waitingOnly} className={!waitingOnly ? 'is-active' : ''} onClick={() => { setWaitingOnly(false); setDate(getTodayDateInputValue()); setPage(1); setSelectedId(null) }} type="button">{i18n.t('ui.pages.staff.waiter_dashboard_page.butun_rezervasiyalar_ff5d9b')}</button>
      <button aria-pressed={waitingOnly} className={waitingOnly ? 'is-active' : ''} onClick={() => { setWaitingOnly(true); setDate(''); setPage(1); setSelectedId(null) }} type="button">{i18n.t('ui.pages.staff.waiter_dashboard_page.gelisi_yoxlanacaq_ef025f')}</button>
    </div>
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.pages.staff.waiter_dashboard_page.size_aid_restoran_tapilmadi_3fdf18')}</StatusMessage> : null}
    {listLoading ? <p className="waiter-reservations-muted">{i18n.t('ui.pages.staff.waiter_dashboard_page.rezervasiyalar_yuklenir_248f13')}</p> : null}
    {!listLoading && !error && restaurantId && data.items.length === 0 ? <div className="waiter-reservations-empty" role="status">
      <span className="waiter-reservations-empty-icon"><CalendarX2 size={22} aria-hidden="true" /></span>
      <div><strong>{waitingOnly ?i18n.t('ui.pages.staff.waiter_dashboard_page.yoxlanacaq_gelis_yoxdur_12151f') :i18n.t('ui.pages.staff.waiter_dashboard_page.aktiv_rezervasiya_yoxdur_fc07f0')}</strong><p>{waitingOnly ?i18n.t('ui.pages.staff.waiter_dashboard_page.hazirda_gelib_masaya_eylesmemis_qonaq__ecd33d') :i18n.t('ui.pages.staff.waiter_dashboard_page.secilen_tarix_ucun_gelisi_idare_edilec_a9d05d')}</p></div>
    </div> : null}
    <section className="waiter-reservations-list" aria-label={i18n.t('ui.pages.staff.waiter_dashboard_page.servis_rezervasiyalari_d36daa')}>
      {!listLoading && !error && data.items.map((item) => {
        const isSelected = selectedId === item.id
        const startsAt = new Date(item.reservedAt).getTime()
        const deadlineAt = new Date(item.noShowDeadlineAt).getTime()
        const state = item.requiresSessionCloseReview ?i18n.t('ui.pages.staff.waiter_dashboard_page.baglanmasi_yoxlanmalidir_87b96f') : item.seatedAt ?i18n.t('ui.pages.staff.waiter_dashboard_page.masaya_eylesib_949740') : item.requiresReceptionReview ?i18n.t('ui.pages.staff.waiter_dashboard_page.netice_yoxlanmalidir_af3e9d') : item.isWaitingOverdue ?i18n.t('ui.pages.staff.waiter_dashboard_page.masa_gozleyir_gecikir_080d4f') : item.arrivedAt ?i18n.t('ui.pages.staff.waiter_dashboard_page.gelib_masa_gozleyir_f2974d') : now >= deadlineAt ?i18n.t('ui.pages.staff.waiter_dashboard_page.gelis_muddeti_bitib_8ece59') :i18n.t('ui.pages.staff.waiter_dashboard_page.gelis_gozlenilir_a8a048')
        return <article className={`waiter-reservation${isSelected ? ' is-selected' : ''}`} key={item.id}>
          <div className="waiter-reservation-top"><div><small>{i18n.t('ui.pages.staff.waiter_dashboard_page.rezervasiya_a13388')}{item.id}</small><h2>{item.customerName}</h2></div><span className={`waiter-reservation-state${item.requiresSessionCloseReview || item.requiresReceptionReview ? ' is-review' : item.seatedAt ? ' is-seated' : item.isWaitingOverdue ? ' is-overdue' : item.arrivedAt ? ' is-arrived' : ''}`}>{state}</span></div>
          <div className="waiter-reservation-meta"><span><Table2 size={17} />{item.tableName}</span><span><CalendarDays size={17} />{formatReservationDateTime(item.reservedAt, item.timeZone || 'Asia/Baku')}</span><span><Users size={17} />{i18n.t('ui.count.guests', { count: item.peopleCount })}</span></div>
          {item.waitingSinceAt && !item.requiresReceptionReview ? <div className="waiter-reservation-waiting"><span>{i18n.t('ui.pages.staff.waiter_dashboard_page.gozleme_1ab81e')} <strong>{i18n.t('ui.count.minutes', { count: item.waitingMinutes })}</strong></span><span>{i18n.t('ui.pages.staff.waiter_dashboard_page.servis_gecikmesi_f86cc5')} <strong>{i18n.t('ui.count.minutes', { count: item.serviceDelayMinutes })}</strong></span></div> : null}
          {isSelected ? <div className="waiter-reservation-detail">
            {!item.arrivedAt ? <p>{i18n.t('ui.pages.staff.waiter_dashboard_page.gelis_ucun_son_vaxt_90dc5f')} {formatReservationDateTime(item.noShowDeadlineAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {item.mustVacateAt ? <p>{i18n.t('ui.pages.staff.waiter_dashboard_page.masani_tehvil_vaxti_0236ce')} {formatReservationDateTime(item.mustVacateAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {item.arrivedAt ? <p>{i18n.t('ui.pages.staff.waiter_dashboard_page.gelis_qeyd_edildi_a35de2')} {formatReservationDateTime(item.arrivedAt, item.timeZone || 'Asia/Baku')}</p> : null}
            {item.requiresReceptionReview ? <p className="waiter-reservation-review-note">{i18n.t('ui.pages.staff.waiter_dashboard_page.xidmet_muddeti_bitib_neticeni_restoran_696207')}</p> : null}
            {item.tableSessionId !== null ? <SessionCloseReviewActions restaurantId={restaurantId} reservationId={item.id} sessionId={item.tableSessionId} canComplete={item.canCompleteSession} completeAs="waiter" canContinue={false} requiresReview={item.requiresSessionCloseReview} reviewDueAt={item.sessionCloseReviewDueAt} reviewConfirmedAt={item.sessionCloseReviewConfirmedAt} timeZone={item.timeZone} deferBill onChanged={(message) => { setActionMessage(message); setReloadKey((value) => value + 1) }} /> : null}
            {item.tableSessionId !== null && item.seatedAt ? <ButtonLink to={`/waiter/restaurants/${restaurantId}/sessions/${item.tableSessionId}/orders`} variant="secondary"><Table2 size={17} />{i18n.t('ui.waiter.openTable')}</ButtonLink> : null}
            {actionsLoading ? <span className="waiter-reservations-muted">{i18n.t('ui.pages.staff.waiter_dashboard_page.emeliyyatlar_yoxlanilir_6e7e8e')}</span> : null}
            {actionsError ? <StatusMessage tone="danger" autoHideMs={false}>{actionsError}</StatusMessage> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !item.requiresReceptionReview && checkIn ? <Button type="button" disabled={busy} onClick={() => setPendingAction(checkIn)}><Table2 size={17} />{i18n.t('ui.pages.staff.waiter_dashboard_page.masaya_eylesdir_41b5ea')}</Button> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !item.arrivedAt && !item.requiresReceptionReview && markArrived ? <Button type="button" variant="secondary" disabled={busy} onClick={() => void execute(markArrived)}><CheckCircle2 size={17} />{i18n.t('ui.pages.staff.waiter_dashboard_page.gelisi_qeyd_et_821eff')}</Button> : null}
            {!actionsLoading && !actionsError && !item.seatedAt && !item.requiresReceptionReview && !markArrived && !checkIn ? <span className="waiter-reservations-muted">{now < startsAt ?i18n.t('ui.pages.staff.waiter_dashboard_page.gelis_emeliyyati_hazirda_elcatan_deyil_89bdf5') : !item.arrivedAt && now >= deadlineAt ?i18n.t('ui.pages.staff.waiter_dashboard_page.gelis_muddeti_bitib_no_show_statusu_ye_cd1e45') :i18n.t('ui.pages.staff.waiter_dashboard_page.hazirda_icra_edile_bilen_emeliyyat_yox_9adc35')}</span> : null}
            {actionError ? <StatusMessage tone="danger">{actionError}</StatusMessage> : null}
            {actionMessage ? <StatusMessage tone="success">{actionMessage}</StatusMessage> : null}
          </div> : null}
          <Button type="button" variant="secondary" className="waiter-reservation-select" aria-expanded={isSelected} onClick={() => { setSelectedId(isSelected ? null : item.id); setActionError(''); setActionMessage('') }}>{isSelected ?i18n.t('ui.pages.staff.waiter_dashboard_page.bagla_c1cf91') :i18n.t('ui.pages.staff.waiter_dashboard_page.idare_et_4f088f')}</Button>
        </article>
      })}
    </section>
    <PaginationControls ariaLabel={i18n.t('ui.pages.staff.waiter_dashboard_page.rezervasiya_sehifeleri_418673')} hasNextPage={data.hasNextPage} hasPreviousPage={data.hasPreviousPage} pageIndex={data.pageIndex} totalPages={data.totalPages} onPageChange={(next) => { setPage(next); setSelectedId(null) }} />
    <ReservationReasonDialog isOpen={Boolean(pendingAction)} title={i18n.t('ui.pages.staff.waiter_dashboard_page.musterini_masaya_eylesdirirsiniz_ebdb4a')} description={i18n.t('ui.pages.staff.waiter_dashboard_page.bu_emeliyyat_gelisi_qeyd_edecek_ve_mas_a221dd')} confirmLabel={i18n.t('ui.pages.staff.waiter_dashboard_page.masaya_eylesdir_41b5ea')} confirmVariant="primary" isSubmitting={busy} error={pendingAction ? actionError : ''} requireReason={false} showReason={false} onClose={() => setPendingAction(null)} onConfirm={() => { if (pendingAction) void execute(pendingAction) }} />
    </>}
  </main>
}
