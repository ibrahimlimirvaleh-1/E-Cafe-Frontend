import { i18n } from '../../shared/i18n/i18n'
import { CalendarDays, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
import { CustomerReservationListItem } from './CustomerReservationListItem'
import './my-reservations.css'
import {
  ReservationDateFilter,
} from '../../features/reservations/ReservationDateFilter'

const emptyPage: PaginatedResponse<ReservationResponse> = {
  items: [],
  pageIndex: 1,
  totalPages: 1,
  totalCount: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}

export function MyReservationsPage() {
  useTranslation()
  const { user } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const refresh = () => setReloadKey((value) => value + 1)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => window.removeEventListener('ecafe:notifications-refresh', refresh)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setRestaurantName(searchInput.trim()), 300)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const query = useMemo(
    () => ({ pageNumber, pageSize, reservedDate: selectedDate, restaurantName }),
    [pageNumber, pageSize, selectedDate, restaurantName],
  )
  const listScope = JSON.stringify([user?.userId, query])
  const { data, error, hasData, isLoading: listLoading, isRefreshing } = useKeyedAsyncData(
    () => ecafeApi.reservations.listMine(query),
    emptyPage,
    listScope,
    [user?.userId, query, reloadKey],
  )
  const isLoading = listLoading || (!hasData && !error)

  useEffect(() => {
    if (hasData && !isLoading && !error && data.totalPages > 0 && pageNumber > data.totalPages) {
      setPageNumber(data.totalPages)
    }
  }, [data.totalPages, error, hasData, isLoading, pageNumber])

  const awaitingPaymentCount = data.items.filter((reservation) => isReservationAwaitingPayment(reservation.status)).length

  const hasFilters = Boolean(selectedDate || restaurantName)

  function clearFilters() {
    setSearchInput('')
    setRestaurantName('')
    setSelectedDate('')
    setPageNumber(1)
  }

  return (
    <main className="page reservations-page my-reservations-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.customer.my_reservations_page.hesab_18adfa')}
        title={i18n.t('ui.pages.customer.my_reservations_page.rezervasiyalarim_52105e')}
        action={<ButtonLink to="/" variant="secondary"><Plus size={17} aria-hidden="true" />{i18n.t('ui.myReservations.new')}</ButtonLink>}
      />

      <section className="reservation-list-toolbar" aria-label={i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_filterleri_4fafc3')}>
        <div className="reservation-name-filter">
          <label htmlFor="my-reservations-restaurant-name">{i18n.t('ui.pages.customer.my_reservations_page.restoran_adi_f96b27')}</label>
          <div className="reservation-name-filter-control">
            <Search aria-hidden="true" size={18} />
            <input
              autoComplete="off"
              id="my-reservations-restaurant-name"
              maxLength={100}
              onChange={(event) => {
                setSearchInput(event.target.value)
                setPageNumber(1)
              }}
              placeholder={i18n.t('ui.pages.customer.my_reservations_page.restoran_axtar_d0fa67')}
              type="search"
              value={searchInput}
            />
            {searchInput ? (
              <button
                aria-label={i18n.t('ui.pages.customer.my_reservations_page.restoran_axtarisini_temizle_279685')}
                onClick={() => {
                  setSearchInput('')
                  setRestaurantName('')
                  setPageNumber(1)
                }}
                title={i18n.t('ui.pages.customer.my_reservations_page.axtarisi_temizle_73be64')}
                type="button"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </div>
        <ReservationDateFilter value={selectedDate} onChange={(value) => {
          setSelectedDate(value)
          setPageNumber(1)
        }} />
      </section>

      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      <div className="my-reservations-results">
        <div>
          <strong>{hasData ? i18n.t('ui.count.reservations', { count: data.totalCount }) : '\u2014'}</strong>
          {awaitingPaymentCount > 0 ? <span className="my-reservations-payment-count">{i18n.t('ui.myReservations.pendingOnPage', { count: awaitingPaymentCount })}</span> : null}
        </div>
        <div className="my-reservations-result-actions">
          {hasFilters ? <button type="button" className="my-reservations-clear" onClick={clearFilters}><X size={14} aria-hidden="true" />{i18n.t('ui.pages.customer.my_reservations_page.filtrleri_temizle_dea7b6')}</button> : null}
          <button className="my-reservations-refresh" type="button" title={i18n.t('ui.myReservations.refresh')} aria-label={i18n.t('ui.myReservations.refresh')} disabled={isLoading || isRefreshing} onClick={() => setReloadKey(value => value + 1)}><RefreshCw size={17} className={isRefreshing ? 'is-refreshing' : ''} aria-hidden="true" /></button>
        </div>
      </div>
      {isLoading ? <div className="my-reservations-loading" role="status" aria-label={i18n.t('ui.pages.customer.my_reservations_page.rezervasiyalar_yuklenir_248f13')}><div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" /></div> : null}

      {!isLoading && (!error || hasData) && data.items.length === 0 ? (
        <section className="reservation-empty-state">
          <CalendarDays size={28} />
          <h2>{hasFilters ?i18n.t('ui.pages.customer.my_reservations_page.axtarisa_uygun_rezervasiya_yoxdur_3c617c') :i18n.t('ui.pages.customer.my_reservations_page.hele_rezervasiyaniz_yoxdur_a42fd2')}</h2>
          <p>{hasFilters ?i18n.t('ui.pages.customer.my_reservations_page.restoran_adini_ve_ya_tarixi_deyiserek__0b9915') :i18n.t('ui.pages.customer.my_reservations_page.restoran_secerek_uygun_masa_ucun_rezer_d11701')}</p>
          {hasFilters ? <Button onClick={clearFilters} variant="secondary">{i18n.t('ui.pages.customer.my_reservations_page.filtrleri_temizle_dea7b6')}</Button> : <ButtonLink to="/">{i18n.t('ui.pages.customer.my_reservations_page.restoranlara_bax_ecbcc4')}</ButtonLink>}
        </section>
      ) : null}

      <section className="customer-reservation-list" aria-busy={isLoading || isRefreshing} aria-label={i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_siyahisi_0ae0f1')}>
        {data.items.map(reservation => <CustomerReservationListItem key={reservation.id} reservation={reservation} />)}
      </section>
      {!isLoading && (!error || hasData) ? (
        <PaginationControls
          ariaLabel={i18n.t('ui.pages.customer.my_reservations_page.rezervasiyalarim_sehifelemesi_cffce8')}
          hasNextPage={data.hasNextPage}
          hasPreviousPage={data.hasPreviousPage}
          pageIndex={data.pageIndex}
          pageSize={pageSize}
          showOnSinglePage
          totalCount={data.totalCount}
          totalPages={data.totalPages}
          onPageChange={setPageNumber}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPageNumber(1)
          }}
        />
      ) : null}
    </main>
  )
}
