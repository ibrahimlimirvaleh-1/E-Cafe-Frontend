import { i18n } from '../../shared/i18n/i18n'
import { ArrowRight, CalendarDays, Clock3, MapPin, Search, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReservationResponse } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { getReservationStatusPresentation, isReservationAwaitingPayment } from '../../shared/lib/reservationStatus'
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
  const { data, error, hasData, isLoading } = useKeyedAsyncData(
    () => ecafeApi.reservations.listMine(query),
    emptyPage,
    listScope,
    [user?.userId, query, reloadKey],
  )

  useEffect(() => {
    if (!isLoading && !error && data.totalPages > 0 && pageNumber > data.totalPages) {
      setPageNumber(data.totalPages)
    }
  }, [data.totalPages, error, isLoading, pageNumber])

  const reservationSummary = useMemo(() => {
    const activeCount = data.items.filter((reservation) => getReservationStatusPresentation(reservation.status).tone !== 'danger').length
    const awaitingPaymentCount = data.items.filter((reservation) => isReservationAwaitingPayment(reservation.status)).length

    return {
      activeCount,
      awaitingPaymentCount,
      totalCount: data.totalCount,
    }
  }, [data.items, data.totalCount])

  const hasFilters = Boolean(selectedDate || restaurantName)

  function clearFilters() {
    setSearchInput('')
    setRestaurantName('')
    setSelectedDate('')
    setPageNumber(1)
  }

  return (
    <main className="page reservations-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.customer.my_reservations_page.hesab_18adfa')}
        title={i18n.t('ui.pages.customer.my_reservations_page.rezervasiyalarim_52105e')}
        description={i18n.t('ui.pages.customer.my_reservations_page.rezervasiyalarinizi_ve_odenis_merhelel_3fca85')}
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
      {isLoading ? <p className="online-only">{i18n.t('ui.pages.customer.my_reservations_page.rezervasiyalar_yuklenir_248f13')}</p> : null}

      {!isLoading && (!error || hasData) && data.items.length > 0 ? (
        <section className="reservation-overview" aria-label={i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_xulasesi_4567e2')}>
          <div>
            <span>{i18n.t('ui.pages.customer.my_reservations_page.bu_sehifede_aktiv_85a4e5')}</span>
            <strong>{reservationSummary.activeCount}</strong>
            <small>{i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_22f559')}</small>
          </div>
          <div>
            <span>{i18n.t('ui.pages.customer.my_reservations_page.bu_sehifede_odenis_gozleyir_9bd337')}</span>
            <strong>{reservationSummary.awaitingPaymentCount}</strong>
            <small>{i18n.t('ui.pages.customer.my_reservations_page.novbeti_addim_e43c8c')}</small>
          </div>
          <div>
            <span>{i18n.t('ui.pages.customer.my_reservations_page.tapilan_f1ac75')}</span>
            <strong>{reservationSummary.totalCount}</strong>
            <small>{i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_22f559')}</small>
          </div>
        </section>
      ) : null}

      {!isLoading && (!error || hasData) && data.items.length === 0 ? (
        <section className="reservation-empty-state">
          <CalendarDays size={28} />
          <h2>{hasFilters ?i18n.t('ui.pages.customer.my_reservations_page.axtarisa_uygun_rezervasiya_yoxdur_3c617c') :i18n.t('ui.pages.customer.my_reservations_page.hele_rezervasiyaniz_yoxdur_a42fd2')}</h2>
          <p>{hasFilters ?i18n.t('ui.pages.customer.my_reservations_page.restoran_adini_ve_ya_tarixi_deyiserek__0b9915') :i18n.t('ui.pages.customer.my_reservations_page.restoran_secerek_uygun_masa_ucun_rezer_d11701')}</p>
          {hasFilters ? <Button onClick={clearFilters} variant="secondary">{i18n.t('ui.pages.customer.my_reservations_page.filtrleri_temizle_dea7b6')}</Button> : <ButtonLink to="/">{i18n.t('ui.pages.customer.my_reservations_page.restoranlara_bax_ecbcc4')}</ButtonLink>}
        </section>
      ) : null}

      <section className="customer-reservation-list" aria-label={i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_siyahisi_0ae0f1')}>
        {data.items.map((reservation) => {
          const presentation = getReservationStatusPresentation(reservation.status)

          return (
            <article className="customer-reservation-card" key={reservation.id}>
              <div className="customer-reservation-card-header">
                <div>
                  <span className="reservation-card-kicker">{i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_0a8e06')}{reservation.id}</span>
                  <h2>{reservation.restaurantName || 'Restoran rezervasiyası'}</h2>
                </div>
                <div className="reservation-card-status">
                  <Badge tone={presentation.tone}>{presentation.label}</Badge>
                  <span>{reservation.expectedArrivalAt ?i18n.t('ui.pages.customer.my_reservations_page.yeni_gelis_fda112') : ''}{formatReservationDateTime(reservation.expectedArrivalAt || reservation.reservedAt)}</span>
                </div>
              </div>

              <div className="customer-reservation-meta">
                <span className="reservation-meta-item"><CalendarDays size={17} /><span><small>{i18n.t('ui.pages.customer.my_reservations_page.gelis_vaxti_449387')}</small><b>{formatReservationDateTime(reservation.reservedAt)}</b></span></span>
                <span className="reservation-meta-item"><MapPin size={17} /><span><small>{i18n.t('ui.pages.customer.my_reservations_page.masa_058c4c')}</small><b>{reservation.tableName || `Masa ${reservation.tableId}`}</b></span></span>
                <span className="reservation-meta-item"><Users size={17} /><span><small>{i18n.t('ui.pages.customer.my_reservations_page.qonaq_sayi_012aa3')}</small><b>{i18n.t('ui.count.guests', { count: reservation.peopleCount })}</b></span></span>
                <span className="reservation-meta-item"><Clock3 size={17} /><span><small>{i18n.t('ui.pages.customer.my_reservations_page.depozit_4a14b8')}</small><b>{reservation.depositAmount > 0 ? `${reservation.depositAmount.toFixed(2)} AZN` :i18n.t('ui.pages.customer.my_reservations_page.teleb_olunmur_46f021')}</b></span></span>
              </div>

              {reservation.depositAmount > 0 ? (
                <div className="reservation-payment-note">
                  <strong>{i18n.t('ui.pages.customer.my_reservations_page.depozit_26e67c')} {reservation.depositAmount.toFixed(2)} AZN</strong>
                  <p>{i18n.t('ui.pages.customer.my_reservations_page.odenis_veziyyetini_ve_novbeti_addimi_r_5bc9bf')}</p>
                </div>
              ) : null}

              <div className="customer-reservation-card-footer">
                <span className="reservation-card-deadline">
                  {reservation.holdExpiresAt
                    ? `Ödəniş üçün son vaxt: ${formatReservationDateTime(reservation.holdExpiresAt)}`
                    : reservation.restaurantResponseExpiresAt
                      ? `Cavab üçün son vaxt: ${formatReservationDateTime(reservation.restaurantResponseExpiresAt)}`
                      :i18n.t('ui.pages.customer.my_reservations_page.rezervasiya_melumatlari_yenilenir_e4d5e6')}
                </span>
                <ButtonLink variant="secondary" to={`/confirmation?reservationId=${reservation.id}`}>
                  {i18n.t('ui.pages.customer.my_reservations_page.detallara_bax_38343d')} <ArrowRight size={16} />
                </ButtonLink>
              </div>
            </article>
          )
        })}
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
