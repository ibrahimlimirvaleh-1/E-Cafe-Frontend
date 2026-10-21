import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarDays, Clock3, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RestaurantSessionCloseReviewQueue } from '../../features/reservations/RestaurantSessionCloseReviewQueue'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { getAccessibleItems, isInRole, RoleIds } from '../../shared/auth/authz'
import { useAsyncData, useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { RestaurantSelectField } from '../../shared/ui/RestaurantSelectField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation } from '../../shared/lib/reservationStatus'
import {
  ReservationDateFilter,
} from '../../features/reservations/ReservationDateFilter'
import '../../features/reservations/reservation-waiting.css'

const defaultPageSize = 20

const emptyPage: PaginatedResponse<ReservationResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasPreviousPage: false, hasNextPage: false,
}

export function RestaurantReservationsPage() {
  const { i18n: translation } = useTranslation()
  const language = translation.resolvedLanguage || translation.language
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTableId, setSelectedTableId] = useState('')
  const [waitingOnly, setWaitingOnly] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const restaurantId = accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId)
    ? selectedRestaurantId
    : accessibleRestaurants[0]?.id || ''
  const { data: restaurantTables, error: tablesError, isLoading: tablesLoading } = useAsyncData(
    () => restaurantId ? ecafeApi.tables.list(restaurantId) : Promise.resolve([]),
    [],
    [restaurantId, language],
  )
  const availableTables = restaurantTables.filter((table) => table.restaurantId === restaurantId)
  const query = useMemo(
    () => ({ pageNumber, pageSize, reservedDate: selectedDate, tableId: selectedTableId, waitingOnly }),
    [pageNumber, pageSize, selectedDate, selectedTableId, waitingOnly],
  )
  const listScope = JSON.stringify([user?.userId, restaurantId, query])
  const { data, error, hasData, isLoading } = useKeyedAsyncData(
    () => restaurantId ? ecafeApi.reservations.listForRestaurant(restaurantId, query) : Promise.resolve(emptyPage),
    emptyPage,
    listScope,
    [user?.userId, restaurantId, query, language, reloadKey],
  )

  useEffect(() => {
    const restaurantIdFromUrl = searchParams.get('restaurantId')
    if (!selectedRestaurantId && restaurantIdFromUrl && accessibleRestaurants.some((restaurant) => restaurant.id === restaurantIdFromUrl)) {
      setSelectedRestaurantId(restaurantIdFromUrl)
    }
  }, [accessibleRestaurants, searchParams, selectedRestaurantId])

  useEffect(() => {
    setPageNumber(1)
    setSelectedTableId('')
  }, [restaurantId])

  function handleRestaurantChange(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    setSelectedTableId('')
    setPageNumber(1)
  }

  function handleDateChange(nextDate: string) {
    setSelectedDate(nextDate)
    setPageNumber(1)
  }

  function handleTableChange(nextTableId: string) {
    setSelectedTableId(nextTableId)
    setPageNumber(1)
  }

  return (
    <main className="admin-page reservations-admin-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.restaurant_reservations_page.restoran_c4df56')}
        title={i18n.t('ui.pages.admin.restaurant_reservations_page.rezervasiyalar_0fbba6')}
        description={i18n.t('ui.pages.admin.restaurant_reservations_page.musteri_rezervasiyalarini_statusuna_go_d63642')}
      />

      {isInRole(user, [RoleIds.Manager, RoleIds.Owner], restaurantId) ? <RestaurantSessionCloseReviewQueue restaurantId={restaurantId} userId={user?.userId || ''} reloadKey={reloadKey} /> : null}

      <section className="admin-panel reservation-admin-toolbar">
        <RestaurantSelectField
          emptyOption={null}
          label={i18n.t('ui.pages.admin.restaurant_reservations_page.restoran_c4df56')}
          onChange={handleRestaurantChange}
          required
          restaurants={accessibleRestaurants}
          value={restaurantId}
        />
        <label className="ui-field reservation-table-filter" htmlFor="reservation-table-filter">
          <span>{i18n.t('ui.pages.admin.restaurant_reservations_page.masa_058c4c')}</span>
          <select
            aria-label={i18n.t('ui.pages.admin.restaurant_reservations_page.masa_058c4c')}
            disabled={!restaurantId || tablesLoading || Boolean(tablesError)}
            id="reservation-table-filter"
            onChange={(event) => handleTableChange(event.target.value)}
            value={selectedTableId}
          >
            <option value="">{tablesLoading ?i18n.t('ui.pages.admin.restaurant_reservations_page.masalar_yuklenir_fa9b85') :i18n.t('ui.pages.admin.restaurant_reservations_page.butun_masalar_2d0a21')}</option>
            {availableTables.map((table) => (
              <option key={table.id} value={table.id}>{table.name || `${i18n.t('ui.pages.customer.table_selection_page.masa_058c4c')} ${table.number}`}</option>
            ))}
          </select>
        </label>
        <ReservationDateFilter value={selectedDate} onChange={handleDateChange} />
      </section>

      <div className="reservation-waiting-filter" role="group" aria-label={i18n.t('ui.pages.admin.restaurant_reservations_page.rezervasiya_gorunusu_6a9376')}>
        <button aria-pressed={!waitingOnly} className={!waitingOnly ? 'is-active' : ''} onClick={() => { setWaitingOnly(false); setPageNumber(1) }} type="button">{i18n.t('ui.pages.admin.restaurant_reservations_page.hamisi_fba8f8')}</button>
        <button aria-pressed={waitingOnly} className={waitingOnly ? 'is-active' : ''} onClick={() => { setWaitingOnly(true); setSelectedDate(''); setPageNumber(1) }} type="button">{i18n.t('ui.pages.admin.restaurant_reservations_page.gelisi_yoxlanacaq_ef025f')}</button>
      </div>

      {!restaurantId ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.pages.admin.restaurant_reservations_page.rezervasiyalari_gormek_ucun_restoran_s_29c23a')}</StatusMessage> : null}
      {tablesError ? <StatusMessage tone="danger" autoHideMs={false}>{i18n.t('ui.pages.admin.restaurant_reservations_page.masalar_yuklenmedi_38b3f8')} {tablesError}</StatusMessage> : null}
      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.restaurant_reservations_page.rezervasiyalar_yuklenir_248f13')}</p> : null}

      {!isLoading && (!error || hasData) && data.items.length === 0 ? (
        <section className="reservation-empty-state reservation-empty-state-admin">
          <CalendarDays size={28} />
          <h2>{waitingOnly ?i18n.t('ui.pages.admin.restaurant_reservations_page.yoxlanacaq_gelis_yoxdur_12151f') : selectedDate || selectedTableId ?i18n.t('ui.pages.admin.restaurant_reservations_page.secilen_filtre_uygun_rezervasiya_yoxdu_9c04d6') :i18n.t('ui.pages.admin.restaurant_reservations_page.rezervasiya_yoxdur_07264e')}</h2>
          <p>{waitingOnly ?i18n.t('ui.pages.admin.restaurant_reservations_page.hazirda_gelib_masaya_eylesmemis_qonaq__ecd33d') : selectedDate || selectedTableId ?i18n.t('ui.pages.admin.restaurant_reservations_page.tarixi_ve_ya_masani_deyiserek_yeniden__bbb86c') :i18n.t('ui.pages.admin.restaurant_reservations_page.bu_restoran_ucun_yeni_rezervasiya_yara_18f5db')}</p>
        </section>
      ) : null}

      {!isLoading && (!error || hasData) && restaurantId && data.items.length > 0 ? (
        <>
          <section className="admin-reservation-list" aria-label={i18n.t('ui.pages.admin.restaurant_reservations_page.restoran_rezervasiyalari_20be39')}>
            <div className="admin-reservation-list-header">
              <div>
                <span className="section-eyebrow">{i18n.t('ui.pages.admin.restaurant_reservations_page.siyahi_a471b0')}</span>
                <strong>{i18n.t('ui.count.reservations', { count: data.totalCount })}</strong>
              </div>
              <span>{i18n.t('ui.pages.admin.restaurant_reservations_page.sehife_6981a2')} {data.pageIndex} / {data.totalPages}</span>
            </div>
            {data.items.map((reservation) => {
              const presentation = getReservationStatusPresentation(reservation.status)

              return (
                <article className="admin-reservation-row" key={reservation.id}>
                  <div className="admin-reservation-row-main">
                    <span className="reservation-card-kicker">{i18n.t('ui.pages.admin.restaurant_reservations_page.rezervasiya_0a8e06')}{reservation.id}</span>
                    <h2>{reservation.customerName || 'Müştəri'}</h2>
                    <span className="admin-reservation-secondary">{reservation.restaurantName || 'Restoran'} · {reservation.tableName || `Masa ${reservation.tableId}`}</span>
                    {reservation.requiresSessionCloseReview ? <span className="admin-reservation-waiting is-review">{i18n.t('ui.pages.admin.restaurant_reservations_page.baglanmasi_yoxlanmalidir_87b96f')}</span> : null}
                    {reservation.requiresReceptionReview ? <span className="admin-reservation-waiting is-review">{i18n.t('ui.pages.admin.restaurant_reservations_page.netice_yoxlanmalidir_af3e9d')}</span> : reservation.waiting ? <span className={`admin-reservation-waiting${reservation.waiting.isOverdue ? ' is-overdue' : ''}`}>{i18n.t('ui.pages.admin.restaurant_reservations_page.masa_gozleyir_3166e1')} {reservation.waiting.waitingMinutes} {i18n.t('ui.pages.admin.restaurant_reservations_page.deq_gozleme_2b0cbd')} {reservation.waiting.serviceDelayMinutes} {i18n.t('ui.pages.admin.restaurant_reservations_page.deq_servis_gecikmesi_48dd32')}</span> : null}
                  </div>
                  <div className="admin-reservation-row-meta">
                    <span><CalendarDays size={16} /><b>{formatReservationDateTime(reservation.reservedAt)}</b></span>
                    <span><Users size={16} />{i18n.t('ui.count.guests', { count: reservation.peopleCount })}</span>
                    <span><Clock3 size={16} />{reservation.depositAmount > 0 ? `${reservation.depositAmount.toFixed(2)} AZN depozit` :i18n.t('ui.pages.admin.restaurant_reservations_page.depozitsiz_db0e7a')}</span>
                  </div>
                  <div className="admin-reservation-row-action">
                    <Badge tone={presentation.tone}>{presentation.label}</Badge>
                    <ButtonLink variant="secondary" to={`/admin/reservations/${reservation.id}?restaurantId=${restaurantId}`}>
                      {i18n.t('ui.pages.admin.restaurant_reservations_page.detal_409b6a')} <ArrowRight size={16} />
                    </ButtonLink>
                  </div>
                </article>
              )
            })}
          </section>
          <PaginationControls
            ariaLabel={i18n.t('ui.pages.admin.restaurant_reservations_page.rezervasiyalar_sehifelemesi_bf49c2')}
            hasNextPage={data.hasNextPage}
            hasPreviousPage={data.hasPreviousPage}
            pageIndex={data.pageIndex}
            pageSize={pageSize}
            totalCount={data.totalCount}
            totalPages={data.totalPages}
            onPageChange={setPageNumber}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPageNumber(1)
            }}
          />
        </>
      ) : null}
    </main>
  )
}
