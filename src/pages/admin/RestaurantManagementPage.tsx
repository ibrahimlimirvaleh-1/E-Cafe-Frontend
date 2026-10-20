import { i18n } from '../../shared/i18n/i18n'
import { AlertTriangle, CheckCircle2, MapPin, Search, UserPlus } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import type { UserProfile } from '../../entities/types'
import { ecafeApi, type GeocodeAddressResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { restaurantRow } from '../../shared/api/mappers'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole, isPlatformAdmin } from '../../shared/auth/authz'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { emptyTranslations, translationPayload } from '../../shared/i18n/contentTranslations'
import { ContentTranslationTabs } from '../../shared/ui/ContentTranslationTabs'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { DataTable } from '../../shared/ui/DataTable'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { PhoneField } from '../../shared/ui/PhoneField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { WorkingHoursField, createDefaultWorkingHours } from '../../shared/ui/WorkingHoursField'

type RestaurantPageMode = 'list' | 'create'

const initialForm = {
  location: '',
  latitude: '',
  longitude: '',
  placeId: '',
  geocodedAddress: '',
  phone: '',
  restaurantGroupEmail: '',
  restaurantGroupId: '',
  restaurantGroupName: '',
  restaurantGroupLegalName: '',
  branchName: '',
  cancellationWindowMinutes: '60',
  reservationPreBlockMinutes: '60',
  tableTurnoverBufferMinutes: '15',
  noShowGraceMinutes: '15',
  paymentHoldMinutes: '15',
  restaurantResponseMinutes: '15',
  serviceFeePercent: '0',
  staffSettlementPeriod: '7',
  timeZone: '',
  workingHours: createDefaultWorkingHours(),
  ownerId: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerFirstName: '',
  ownerLastName: '',
}

const defaultPageSize = 10
type OwnerMode = 'existing' | 'new'
type RestaurantFormState = typeof initialForm

function isOwnerProfile(user: UserProfile) {
  return user.roleId === Number(RoleIds.Owner) || user.role.toLowerCase().includes('sahibkar') || user.role.toLowerCase().includes('owner')
}

function ownerInitials(owner: Pick<UserProfile, 'name' | 'surname'>) {
  return `${owner.name.charAt(0)}${owner.surname.charAt(0)}`.toUpperCase() || 'S'
}

function ownerPayload(ownerMode: OwnerMode, form: RestaurantFormState) {
  if (ownerMode === 'existing') {
    return {
      id: form.ownerId || null,
      searchText: form.ownerEmail || null,
      email: form.ownerEmail || null,
      phone: null,
      firstName: null,
      lastName: null,
    }
  }

  return {
    id: null,
    searchText: form.ownerEmail || null,
    email: form.ownerEmail || null,
    phone: form.ownerPhone || null,
    firstName: form.ownerFirstName || null,
    lastName: form.ownerLastName || null,
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

type GeocodeFormFields = Pick<RestaurantFormState, 'location' | 'branchName' | 'restaurantGroupName'>

function joinUniqueSearchParts(parts: string[]) {
  return parts
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .join(' ')
}

function buildGeocodeSearchTexts(form: GeocodeFormFields) {
  const rawLocation = form.location.trim()
  const searches = [
    joinUniqueSearchParts([rawLocation, form.branchName, form.restaurantGroupName, 'Bakı', 'Azərbaycan']),
    joinUniqueSearchParts([rawLocation, 'Bakı', 'Azərbaycan']),
    rawLocation,
    joinUniqueSearchParts([form.branchName, form.restaurantGroupName, 'Bakı', 'Azərbaycan']),
  ]

  return searches
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
}

async function geocodeWithFallback(form: GeocodeFormFields) {
  let lastError: unknown

  for (const searchText of buildGeocodeSearchTexts(form)) {
    try {
      const results = await ecafeApi.restaurants.geocode(searchText)

      if (results.length > 0) {
        return results
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Məkan xəritədə tapılmadı.')
}

export function RestaurantManagementPage({ mode = 'list' }: { mode?: RestaurantPageMode }) {
  const { i18n: activeI18n } = useTranslation()
  const { selectProfileForRestaurant, user } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [search, setSearch] = useState('')
  const [fileIds, setFileIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [form, setForm] = useState(initialForm)
  const [translations, setTranslations] = useState(emptyTranslations)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [locationResults, setLocationResults] = useState<GeocodeAddressResponse[]>([])
  const [ownerMode, setOwnerMode] = useState<OwnerMode>('existing')
  const query = useMemo(() => {
    const params = new URLSearchParams({
      pageNumber: String(pageNumber),
      pageSize: String(pageSize),
    })

    if (search.trim()) {
      params.set('search', search.trim())
    }

    return `?${params.toString()}`
  }, [pageNumber, pageSize, search])
  const { data: restaurantPage, isLoading } = useKeyedAsyncData(() => ecafeApi.restaurants.page(query), {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }, query, [query, reloadKey, activeI18n.resolvedLanguage])
  const { data: groups } = useKeyedAsyncData(() => ecafeApi.restaurantGroups.list(), [], 'groups', [reloadKey, activeI18n.resolvedLanguage])
  const canCreateRestaurants = isInRole(user, [RoleIds.PlatformAdmin])
  const canSearchRestaurants = isInRole(user, [RoleIds.PlatformAdmin])
  const { data: users } = useKeyedAsyncData(
    () => (mode === 'create' && canCreateRestaurants ? ecafeApi.users.list() : Promise.resolve([])),
    [],
    `${canCreateRestaurants}:${mode}`,
    [canCreateRestaurants, mode, reloadKey],
  )
  const pageTitle = mode === 'create' ? 'Yeni restoran' : canSearchRestaurants ? 'Restoranlar' : 'Restoran'
  const visibleRestaurants = isPlatformAdmin(user)
    ? restaurantPage.items
    : restaurantPage.items.filter((restaurant) => restaurant.id === user?.restaurantId)
  const ownerSearch = form.ownerEmail.trim().toLowerCase()
  const ownerCandidates = useMemo(
    () =>
      users
        .filter((candidate) => isOwnerProfile(candidate))
        .filter((candidate) => {
          if (!ownerSearch) {
            return false
          }

          return [
            candidate.name,
            candidate.surname,
            candidate.email,
            candidate.phone,
          ].some((value) => value?.toLowerCase().includes(ownerSearch))
        })
        .slice(0, 4),
    [ownerSearch, users],
  )
  const selectedOwner = users.find((candidate) => candidate.id === form.ownerId)
  const selectedGroup = groups.find((group) => group.id === form.restaurantGroupId)
  const duplicateGroupEmail = useMemo(() => {
    const email = normalizeEmail(form.restaurantGroupEmail)

    if (!email || form.restaurantGroupId) {
      return []
    }

    return groups.filter((group) => normalizeEmail(group.email || '') === email)
  }, [form.restaurantGroupEmail, form.restaurantGroupId, groups])

  if (mode === 'create' && !canCreateRestaurants) {
    return <Navigate to="/admin/restaurants" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageDetails([])

    if (!form.location.trim() || !form.branchName.trim()) {
      setMessage('AZ bölməsində ünvan və filial adını tamamlayın.')
      return
    }

    if (ownerMode === 'existing' && !form.ownerId && !form.ownerEmail.trim()) {
      setMessage('Sahibkar seçilməlidir.')
      setMessageDetails([{ label: 'Sahibkar', message: 'Mövcud sahibkarı axtarıb seçin və ya yeni sahibkar yarat bölməsinə keçin.' }])
      return
    }

    if (ownerMode === 'new' && (!form.ownerEmail.trim() || !form.ownerPhone.trim() || !form.ownerFirstName.trim() || !form.ownerLastName.trim())) {
      setMessage('Yeni sahibkar məlumatları tamamlanmalıdır.')
      setMessageDetails([{ label: 'Sahibkar', message: 'Yeni sahibkar yaratmaq üçün ad, soyad, email və telefon sahələrini doldurun.' }])
      return
    }

    try {
      await ecafeApi.restaurants.create({
        location: form.location,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        placeId: form.placeId || null,
        phone: form.phone,
        restaurantGroupId: form.restaurantGroupId || undefined,
        restaurantGroupName: form.restaurantGroupId ? undefined : form.restaurantGroupName,
        restaurantGroupLegalName: form.restaurantGroupId ? undefined : form.restaurantGroupLegalName,
        restaurantGroupEmail: form.restaurantGroupId ? undefined : form.restaurantGroupEmail,
        branchName: form.branchName,
        translations: translationPayload(translations, ['name', 'branchName', 'location']),
        cancellationWindowMinutes: Number(form.cancellationWindowMinutes),
        reservationPreBlockMinutes: Number(form.reservationPreBlockMinutes),
        tableTurnoverBufferMinutes: Number(form.tableTurnoverBufferMinutes),
        noShowGraceMinutes: Number(form.noShowGraceMinutes),
        paymentHoldMinutes: Number(form.paymentHoldMinutes),
        restaurantResponseMinutes: Number(form.restaurantResponseMinutes),
        serviceFeePercent: Number(form.serviceFeePercent),
        staffSettlementPeriod: Number(form.staffSettlementPeriod),
        timeZone: form.timeZone,
        workingHours: form.workingHours,
        defaultWaiterTableLimit: null,
        owner: ownerPayload(ownerMode, form),
        fileIds,
      })
      setForm(initialForm)
      setTranslations(emptyTranslations())
      setFileIds([])
      setOwnerMode('existing')
      setMessage('Restoran yaradıldı.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Restoran yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleGeocode() {
    setMessage('')
    setMessageDetails([])
    setIsGeocoding(true)
    setLocationResults([])

    try {
      const results = await geocodeWithFallback(form)
      setLocationResults(results)
      setMessage(results.length > 1 ? 'Uyğun məkanı seçin.' : 'Məkan xəritədə tapıldı. Davam etmək üçün nəticəni seçin.')
      setMessageDetails([])
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Məkan xəritədə tapılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    } finally {
      setIsGeocoding(false)
    }
  }

  function handleLocationChange(value: string) {
    setForm({ ...form, location: value, latitude: '', longitude: '', placeId: '', geocodedAddress: '', timeZone: '' })
    setLocationResults([])
  }

  function handleSelectLocation(result: GeocodeAddressResponse) {
    setForm((current) => ({
      ...current,
      location: result.displayName,
      latitude: String(result.latitude),
      longitude: String(result.longitude),
      placeId: result.placeId || '',
      geocodedAddress: result.displayName,
      timeZone: result.timeZone || current.timeZone,
    }))
    setLocationResults([])
    setMessage('Məkan seçildi.')
    setMessageDetails([{ label: 'Seçilmiş məkan', message: result.displayName }])
  }

  function handleOwnerModeChange(nextMode: OwnerMode) {
    setOwnerMode(nextMode)
    setForm((current) => ({
      ...current,
      ownerId: '',
      ownerEmail: '',
      ownerPhone: '',
      ownerFirstName: '',
      ownerLastName: '',
    }))
  }

  function handleSelectOwner(owner: UserProfile) {
    setForm((current) => ({
      ...current,
      ownerId: owner.id,
      ownerEmail: owner.email,
      ownerPhone: owner.phone,
      ownerFirstName: owner.name,
      ownerLastName: owner.surname,
    }))
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.restaurant_management_page.admin_c1c224')}
        title={pageTitle}
        action={
          mode === 'create' ? (
            <ButtonLink to="/admin/restaurants" variant="secondary">{i18n.t('ui.pages.admin.restaurant_management_page.siyahiya_qayit_f779ce')}</ButtonLink>
          ) : canCreateRestaurants ? (
            <ButtonLink to="/admin/restaurants/new">{i18n.t('ui.pages.admin.restaurant_management_page.yeni_restoran_651205')}</ButtonLink>
          ) : undefined
        }
      />

      {mode === 'list' ? (
        <section>
          {canSearchRestaurants ? (
            <section className="catalog-toolbar admin-list-toolbar">
              <label className="site-search catalog-search">
                <Search size={18} />
                <input
                  placeholder={i18n.t('ui.pages.admin.restaurant_management_page.restoran_filial_ve_ya_mekan_uzre_axtar_a3d7ed')}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPageNumber(1)
                  }}
                />
              </label>
              <span>{restaurantPage.totalCount} {i18n.t('ui.pages.admin.restaurant_management_page.restoran_07172a')}</span>
            </section>
          ) : null}
          {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.restaurant_management_page.restoranlar_yuklenir_c633c2')}</p> : null}
          <DataTable
            baseRoute="/admin/restaurants"
            canEdit={isInRole(user, [RoleIds.PlatformAdmin, RoleIds.Owner, RoleIds.Manager])}
            columns={['Restoran', 'Status', 'Müqavilə', 'Telefon']}
            onActionNavigate={(row) => selectProfileForRestaurant(row.id)}
            rows={visibleRestaurants.map(restaurantRow)}
          />
          {canSearchRestaurants ? (
            <PaginationControls
              ariaLabel={i18n.t('ui.pages.admin.restaurant_management_page.admin_restoran_sehifeleme_450c83')}
              hasNextPage={restaurantPage.hasNextPage}
              hasPreviousPage={restaurantPage.hasPreviousPage}
              pageIndex={restaurantPage.pageIndex}
              pageSize={pageSize}
              totalCount={restaurantPage.totalCount}
              totalPages={restaurantPage.totalPages}
              onPageChange={setPageNumber}
              onPageSizeChange={(value) => {
                setPageSize(value)
                setPageNumber(1)
              }}
            />
          ) : null}
        </section>
      ) : (
        <form className="admin-panel admin-single-column" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">{i18n.t('ui.pages.admin.restaurant_management_page.yeni_restoran_651205')}</span>
            <h2>{i18n.t('ui.pages.admin.restaurant_management_page.profil_ve_filial_cdf029')}</h2>
          </div>
          <ContentTranslationTabs fields={['name', 'branchName', 'location']} value={translations} onChange={setTranslations} azContent={<div className="form-grid two">
            <div className="location-lookup-field">
              <TextField
                label={i18n.t('ui.pages.admin.restaurant_management_page.mekan_a979c9')}
                required
                value={form.location}
                onChange={(event) => handleLocationChange(event.target.value)}
              />
              <Button disabled={isGeocoding || !form.location.trim()} type="button" variant="secondary" onClick={handleGeocode}>
                <MapPin size={17} />
                {isGeocoding ?i18n.t('ui.pages.admin.restaurant_management_page.axtarilir_119f6d') :i18n.t('ui.pages.admin.restaurant_management_page.xeritede_tesdiqle_faba3c')}
              </Button>
              {locationResults.length > 0 ? (
                <div className="location-results" role="listbox" aria-label={i18n.t('ui.pages.admin.restaurant_management_page.xerite_neticeleri_130010')}>
                  {locationResults.map((result) => (
                    <button
                      key={`${result.placeId || result.displayName}-${result.latitude}-${result.longitude}`}
                      type="button"
                      onClick={() => handleSelectLocation(result)}
                    >
                      <MapPin size={16} />
                      <span>{result.displayName}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {form.geocodedAddress ? (
                <small className="field-hint selected-location-hint">
                  <CheckCircle2 size={14} />
                  {i18n.t('ui.pages.admin.restaurant_management_page.secilmis_mekan_2497bc')} {form.geocodedAddress}
                </small>
              ) : form.location.trim() ? (
                <small className="field-hint unverified-location-hint">
                  <AlertTriangle size={14} />
                  {i18n.t('ui.pages.admin.restaurant_management_page.unvan_xeritede_tesdiqlenmeyib_restoran_9a2d7a')}
                </small>
              ) : null}
            </div>
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.filial_adi_6e2940')} required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} />
          </div>} />
          <div className="form-grid two">
            <PhoneField label={i18n.t('ui.pages.admin.restaurant_management_page.telefon_fa6906')} required value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          </div>
          <WorkingHoursField value={form.workingHours} onChange={(workingHours) => setForm({ ...form, workingHours })} />
          <SelectField
            label={i18n.t('ui.pages.admin.restaurant_management_page.movcud_restoran_qrupu_70515e')}
            value={form.restaurantGroupId}
            onChange={(event) => setForm({ ...form, restaurantGroupId: event.target.value, restaurantGroupEmail: '' })}
            hint={i18n.t('ui.pages.admin.restaurant_management_page.bos_qalsa_asagidaki_qrup_adi_ile_yeni__5626e9')}
          >
            <option value="">{i18n.t('ui.pages.admin.restaurant_management_page.yeni_qrup_yarat_288d2d')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </SelectField>
          {!form.restaurantGroupId ? (
            <div className="form-grid two">
              <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.yeni_qrup_adi_88629a')} required value={form.restaurantGroupName} onChange={(event) => setForm({ ...form, restaurantGroupName: event.target.value })} />
              <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.yeni_qrup_legal_adi_89313d')} value={form.restaurantGroupLegalName} onChange={(event) => setForm({ ...form, restaurantGroupLegalName: event.target.value })} />
              <div className="form-grid-full">
                <TextField
                  label={i18n.t('ui.pages.admin.restaurant_management_page.qrup_elaqe_emaili_dac066')}
                  required
                  type="email"
                  value={form.restaurantGroupEmail}
                  onChange={(event) => setForm({ ...form, restaurantGroupEmail: event.target.value })}
                />
                {duplicateGroupEmail.length > 0 ? (
                  <div className="soft-warning-panel" role="status">
                    <strong>{i18n.t('ui.pages.admin.restaurant_management_page.bu_email_artiq_basqa_qrupda_istifade_o_0d0e24')}</strong>
                    <span>
                      {duplicateGroupEmail.map((group) => group.name).join(', ')} {i18n.t('ui.pages.admin.restaurant_management_page.qrupu_ile_eyni_elaqe_emaili_yazilib_du_9dfc15')}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : selectedGroup ? (
            <div className="selected-group-contact">
              <span>{i18n.t('ui.pages.admin.restaurant_management_page.qrup_elaqe_emaili_dac066')}</span>
              <strong>{selectedGroup.email || 'Email qeyd edilməyib'}</strong>
            </div>
          ) : null}
          <div className="form-grid two">
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.servis_faizi_176e69')} min={0} required step="0.01" type="number" value={form.serviceFeePercent} onChange={(event) => setForm({ ...form, serviceFeePercent: event.target.value })} />
          </div>
          <div className="form-grid two">
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.legv_penceresi_deqiqe_d410e0')} min={0} required type="number" value={form.cancellationWindowMinutes} onChange={(event) => setForm({ ...form, cancellationWindowMinutes: event.target.value })} />
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.personal_hesablasma_gunu_372e83')} min={1} required type="number" value={form.staffSettlementPeriod} onChange={(event) => setForm({ ...form, staffSettlementPeriod: event.target.value })} />
          </div>
          <div className="form-grid two">
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.novbeti_rezervasiyadan_evvel_qoruma_mu_82a761')} min={15} max={180} required type="number" value={form.reservationPreBlockMinutes} onChange={(event) => setForm({ ...form, reservationPreBlockMinutes: event.target.value })} />
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.masa_hazirliq_bufferi_deqiqe_be3c13')} min={0} max={120} required type="number" value={form.tableTurnoverBufferMinutes} onChange={(event) => setForm({ ...form, tableTurnoverBufferMinutes: event.target.value })} />
          </div>
          <div className="form-grid two">
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.no_show_gozleme_muddeti_deqiqe_daeff8')} min={0} max={120} required type="number" value={form.noShowGraceMinutes} onChange={(event) => setForm({ ...form, noShowGraceMinutes: event.target.value })} />
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.odenis_ucun_hold_muddeti_deqiqe_7cd0da')} min={1} max={120} required type="number" value={form.paymentHoldMinutes} onChange={(event) => setForm({ ...form, paymentHoldMinutes: event.target.value })} />
          </div>
          <div className="form-grid two">
            <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.restoranin_cavab_muddeti_deqiqe_485504')} min={1} max={120} required type="number" value={form.restaurantResponseMinutes} onChange={(event) => setForm({ ...form, restaurantResponseMinutes: event.target.value })} />
          </div>
          <div>
            <span className="eyebrow">{i18n.t('ui.pages.admin.restaurant_management_page.sahibkar_15d31f')}</span>
            <h2>{i18n.t('ui.pages.admin.restaurant_management_page.sahibkari_restorana_bagla_6cd9ec')}</h2>
            <p className="form-helper">{i18n.t('ui.pages.admin.restaurant_management_page.movcud_sahibkari_email_ve_ya_telefonla_620231')}</p>
          </div>
          <div className="owner-mode-switch" role="group" aria-label={i18n.t('ui.pages.admin.restaurant_management_page.sahibkar_secimi_74dfc7')}>
            <button
              className={ownerMode === 'existing' ? 'active' : ''}
              onClick={() => handleOwnerModeChange('existing')}
              type="button"
            >
              <CheckCircle2 size={18} />
              <span>
                <strong>{i18n.t('ui.pages.admin.restaurant_management_page.movcud_sahibkar_e27333')}</strong>
                <small>{i18n.t('ui.pages.admin.restaurant_management_page.sistemde_olan_sahibkari_sec_116fc6')}</small>
              </span>
            </button>
            <button
              className={ownerMode === 'new' ? 'active' : ''}
              onClick={() => handleOwnerModeChange('new')}
              type="button"
            >
              <UserPlus size={18} />
              <span>
                <strong>{i18n.t('ui.pages.admin.restaurant_management_page.yeni_sahibkar_b8424d')}</strong>
                <small>{i18n.t('ui.pages.admin.restaurant_management_page.yeni_sahibkar_hesabi_yarat_2aa508')}</small>
              </span>
            </button>
          </div>
          {ownerMode === 'existing' ? (
            <div className="owner-picker">
              <TextField
                hint={i18n.t('ui.pages.admin.restaurant_management_page.email_telefon_ad_ve_ya_soyad_yazin_tap_cc1dc4')}
                label={i18n.t('ui.pages.admin.restaurant_management_page.sahibkar_emaili_ve_ya_telefonu_398f21')}
                required
                value={form.ownerEmail}
                onChange={(event) => setForm({ ...form, ownerEmail: event.target.value, ownerId: '' })}
              />
              {selectedOwner ? (
                <article className="owner-selected-card">
                  <div className="owner-avatar">{ownerInitials(selectedOwner)}</div>
                  <div>
                    <strong>{selectedOwner.name} {selectedOwner.surname}</strong>
                    <span>{selectedOwner.email} - {selectedOwner.phone}</span>
                  </div>
                  <small>{i18n.t('ui.pages.admin.restaurant_management_page.secildi_ba82f3')}</small>
                </article>
              ) : ownerCandidates.length > 0 ? (
                <div className="owner-results" aria-label={i18n.t('ui.pages.admin.restaurant_management_page.sahibkar_axtaris_neticeleri_7be8d1')}>
                  {ownerCandidates.map((candidate) => (
                    <button key={candidate.id} onClick={() => handleSelectOwner(candidate)} type="button">
                      <div className="owner-avatar">{ownerInitials(candidate)}</div>
                      <span>
                        <strong>{candidate.name} {candidate.surname}</strong>
                        <small>{candidate.email} - {candidate.phone}</small>
                      </span>
                      <small>{i18n.t('ui.pages.admin.restaurant_management_page.sec_6caa06')}</small>
                    </button>
                  ))}
                </div>
              ) : ownerSearch ? (
                <p className="owner-empty-message">{i18n.t('ui.pages.admin.restaurant_management_page.bu_melumatla_sahibkar_tapilmadi_yeni_s_628ca3')}</p>
              ) : null}
            </div>
          ) : (
            <div className="new-owner-fields">
              <div className="form-grid two">
                <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.sahibkar_emaili_5cb1df')} required type="email" value={form.ownerEmail} onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })} />
                <PhoneField label={i18n.t('ui.pages.admin.restaurant_management_page.telefon_fa6906')} required value={form.ownerPhone} onChange={(ownerPhone) => setForm({ ...form, ownerPhone })} />
              </div>
              <div className="form-grid two">
                <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.ad_1d97c9')} required value={form.ownerFirstName} onChange={(event) => setForm({ ...form, ownerFirstName: event.target.value })} />
                <TextField label={i18n.t('ui.pages.admin.restaurant_management_page.soyad_3d89d4')} required value={form.ownerLastName} onChange={(event) => setForm({ ...form, ownerLastName: event.target.value })} />
              </div>
            </div>
          )}
          <FileUploadField
            label={i18n.t('ui.pages.admin.restaurant_management_page.restoran_sekli_cb8de8')}
            accept="image/jpeg,image/png,image/webp,image/avif"
            onUploaded={(fileId) => {
              if (fileId) {
                setFileIds((current) => [...current, fileId])
              }
            }}
          />
          <Button type="submit">{i18n.t('ui.pages.admin.restaurant_management_page.restoran_yarat_c1f7ca')}</Button>
          {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
        </form>
      )}
    </main>
  )
}

export function RestaurantCreatePage() {
  return <RestaurantManagementPage mode="create" />
}
