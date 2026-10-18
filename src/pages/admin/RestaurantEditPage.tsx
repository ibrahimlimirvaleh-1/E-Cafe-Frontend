import { i18n } from '../../shared/i18n/i18n'
import { AlertTriangle, CheckCircle2, MapPin } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ecafeApi, type GeocodeAddressResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PhoneField } from '../../shared/ui/PhoneField'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { WorkingHoursList, createDefaultWorkingHours } from '../../shared/ui/WorkingHoursField'
import { RestaurantDepositRulesPanel } from '../../features/reservations/RestaurantDepositRulesPanel'
import { RestaurantSchedulePanel } from '../../features/reservations/RestaurantSchedulePanel'
import { RestaurantMobileModuleSection } from '../../features/mobileDownload/RestaurantMobileModuleSection'

type GeocodeFormFields = { location: string; branchName: string; restaurantGroupName: string }

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

export function RestaurantEditPage() {
  const navigate = useNavigate()
  const { restaurantId = '' } = useParams()
  const { user } = useAuth()
  const canEditRestrictedSettings = isInRole(user, [RoleIds.PlatformAdmin])
  const canEditRestaurants = canEditRestrictedSettings || isInRole(user, [RoleIds.Owner, RoleIds.Manager], restaurantId)
  const { data: restaurant, isLoading } = useAsyncData(() => ecafeApi.restaurants.adminDetail(restaurantId), null, [restaurantId])
  const { data: groups } = useAsyncData(
    () => canEditRestrictedSettings ? ecafeApi.restaurantGroups.list() : Promise.resolve([]),
    [],
    [canEditRestrictedSettings],
  )
  const [fileIds, setFileIds] = useState<number[]>([])
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState<ApiErrorDetail[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
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
  })
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [locationResults, setLocationResults] = useState<GeocodeAddressResponse[]>([])

  useEffect(() => {
    if (!restaurant) {
      return
    }

    setForm({
      location: restaurant.address,
      latitude: restaurant.latitude == null ? '' : String(restaurant.latitude),
      longitude: restaurant.longitude == null ? '' : String(restaurant.longitude),
      placeId: restaurant.placeId || '',
      geocodedAddress: restaurant.latitude != null && restaurant.longitude != null ? restaurant.address : '',
      phone: restaurant.phone,
      restaurantGroupEmail: '',
      restaurantGroupId: restaurant.restaurantGroupId || '',
      restaurantGroupName: restaurant.restaurantGroupName || '',
      restaurantGroupLegalName: '',
      branchName: restaurant.branchName || '',
      cancellationWindowMinutes: String(restaurant.cancellationWindowMinutes ?? 60),
      reservationPreBlockMinutes: String(restaurant.reservationPreBlockMinutes ?? 60),
      tableTurnoverBufferMinutes: String(restaurant.tableTurnoverBufferMinutes ?? 15),
      noShowGraceMinutes: String(restaurant.noShowGraceMinutes ?? 15),
      paymentHoldMinutes: String(restaurant.paymentHoldMinutes ?? 15),
      restaurantResponseMinutes: String(restaurant.restaurantResponseMinutes ?? 15),
      serviceFeePercent: String(restaurant.defaultServiceFeePercent),
      staffSettlementPeriod: '7',
      timeZone: restaurant.timeZone || '',
      workingHours: restaurant.workingHours.length > 0 ? restaurant.workingHours : createDefaultWorkingHours(),
    })
  }, [restaurant])

  if (!canEditRestaurants) {
    return <Navigate to={`/admin/restaurants/${restaurantId || ''}`} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setErrorDetails([])
    setIsSubmitting(true)

    try {
      await ecafeApi.restaurants.update(restaurantId, {
        location: form.location,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        placeId: form.placeId || null,
        phone: form.phone,
        ...(canEditRestrictedSettings ? {
          restaurantGroupId: form.restaurantGroupId || undefined,
          restaurantGroupName: form.restaurantGroupId ? undefined : form.restaurantGroupName,
          restaurantGroupLegalName: form.restaurantGroupId ? undefined : form.restaurantGroupLegalName,
          restaurantGroupEmail: form.restaurantGroupId ? undefined : form.restaurantGroupEmail,
          serviceFeePercent: Number(form.serviceFeePercent),
          staffSettlementPeriod: Number(form.staffSettlementPeriod),
        } : {}),
        branchName: form.branchName,
        cancellationWindowMinutes: Number(form.cancellationWindowMinutes),
        reservationPreBlockMinutes: Number(form.reservationPreBlockMinutes),
        tableTurnoverBufferMinutes: Number(form.tableTurnoverBufferMinutes),
        noShowGraceMinutes: Number(form.noShowGraceMinutes),
        paymentHoldMinutes: Number(form.paymentHoldMinutes),
        restaurantResponseMinutes: Number(form.restaurantResponseMinutes),
        timeZone: form.timeZone,
        workingHours: form.workingHours,
        defaultWaiterTableLimit: null,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
      })
      navigate(`/admin/restaurants/${restaurantId}`)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Restoran saxlanılmadı.')
      setError(feedback.message)
      setErrorDetails(feedback.details)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGeocode() {
    setError('')
    setErrorDetails([])
    setIsGeocoding(true)
    setLocationResults([])

    try {
      const results = await geocodeWithFallback(form)
      setLocationResults(results)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Məkan xəritədə tapılmadı.')
      setError(feedback.message)
      setErrorDetails(feedback.details)
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
    setError('')
    setErrorDetails([])
  }

  if (isLoading || !restaurant) {
    return (
      <main className="admin-page narrow">
        <p className="online-only">{i18n.t('ui.pages.admin.restaurant_edit_page.restoran_melumatlari_yuklenir_b08a45')}</p>
      </main>
    )
  }

  return (
    <main className="admin-page narrow">
      <PageHeader eyebrow={i18n.t('ui.pages.admin.restaurant_edit_page.restoran_redaktesi_96b05c')} title={restaurant.name} />

      {canEditRestrictedSettings ? <RestaurantMobileModuleSection key={restaurantId} restaurantId={restaurantId} /> : null}

      <form className="admin-panel" onSubmit={handleSubmit}>
        <div className="form-grid two">
          <div className="location-lookup-field">
            <TextField
              label={i18n.t('ui.pages.admin.restaurant_edit_page.mekan_a979c9')}
              required
              value={form.location}
              onChange={(event) => handleLocationChange(event.target.value)}
            />
            <Button disabled={isGeocoding || !form.location.trim()} type="button" variant="secondary" onClick={handleGeocode}>
              <MapPin size={17} />
              {isGeocoding ?i18n.t('ui.pages.admin.restaurant_edit_page.axtarilir_119f6d') :i18n.t('ui.pages.admin.restaurant_edit_page.xeritede_tesdiqle_faba3c')}
            </Button>
            {locationResults.length > 0 ? (
              <div className="location-results" role="listbox" aria-label={i18n.t('ui.pages.admin.restaurant_edit_page.xerite_neticeleri_130010')}>
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
                {i18n.t('ui.pages.admin.restaurant_edit_page.secilmis_mekan_2497bc')} {form.geocodedAddress}
              </small>
            ) : form.location.trim() ? (
              <small className="field-hint unverified-location-hint">
                <AlertTriangle size={14} />
                {i18n.t('ui.pages.admin.restaurant_edit_page.unvan_xeritede_tesdiqlenmeyib_restoran_3d258f')}
              </small>
            ) : null}
          </div>
          <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.filial_adi_6e2940')} required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} />
        </div>
        <div className="form-grid two">
          <PhoneField label={i18n.t('ui.pages.admin.restaurant_edit_page.telefon_fa6906')} required value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        </div>
        <div>
          <h2 className="section-title">{i18n.t('ui.pages.admin.restaurant_edit_page.hazirki_is_saatlari_c10438')}</h2>
          <WorkingHoursList workingHours={restaurant.workingHours} />
        </div>
        {canEditRestrictedSettings ? (
          <>
            <SelectField label={i18n.t('ui.pages.admin.restaurant_edit_page.restoran_qrupu_941ef2')} value={form.restaurantGroupId} onChange={(event) => setForm({ ...form, restaurantGroupId: event.target.value, restaurantGroupEmail: '' })}>
              <option value="">{i18n.t('ui.pages.admin.restaurant_edit_page.yeni_qrup_yarat_288d2d')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </SelectField>
            {!form.restaurantGroupId ? (
              <div className="form-grid two">
                <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.yeni_qrup_adi_88629a')} required value={form.restaurantGroupName} onChange={(event) => setForm({ ...form, restaurantGroupName: event.target.value })} />
                <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.yeni_qrup_legal_adi_89313d')} value={form.restaurantGroupLegalName} onChange={(event) => setForm({ ...form, restaurantGroupLegalName: event.target.value })} />
                <TextField
                  label={i18n.t('ui.pages.admin.restaurant_edit_page.qrup_elaqe_emaili_dac066')}
                  required
                  type="email"
                  value={form.restaurantGroupEmail}
                  onChange={(event) => setForm({ ...form, restaurantGroupEmail: event.target.value })}
                />
              </div>
            ) : null}
          </>
        ) : null}
        <div className="form-grid two">
          {canEditRestrictedSettings ? (
            <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.servis_faizi_176e69')} min={0} required step="0.01" type="number" value={form.serviceFeePercent} onChange={(event) => setForm({ ...form, serviceFeePercent: event.target.value })} />
          ) : null}
        </div>
        <div className="form-grid two">
          <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.legv_penceresi_deqiqe_d410e0')} min={0} required type="number" value={form.cancellationWindowMinutes} onChange={(event) => setForm({ ...form, cancellationWindowMinutes: event.target.value })} />
          {canEditRestrictedSettings ? (
            <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.personal_hesablasma_gunu_372e83')} min={1} required type="number" value={form.staffSettlementPeriod} onChange={(event) => setForm({ ...form, staffSettlementPeriod: event.target.value })} />
          ) : null}
        </div>
        <div className="form-grid two">
          <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.novbeti_rezervasiyadan_evvel_qoruma_mu_82a761')} min={15} max={180} required type="number" value={form.reservationPreBlockMinutes} onChange={(event) => setForm({ ...form, reservationPreBlockMinutes: event.target.value })} />
          <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.masa_hazirliq_bufferi_deqiqe_be3c13')} min={0} max={120} required type="number" value={form.tableTurnoverBufferMinutes} onChange={(event) => setForm({ ...form, tableTurnoverBufferMinutes: event.target.value })} />
        </div>
        <div className="form-grid two">
          <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.no_show_gozleme_muddeti_deqiqe_daeff8')} min={0} max={120} required type="number" value={form.noShowGraceMinutes} onChange={(event) => setForm({ ...form, noShowGraceMinutes: event.target.value })} />
          <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.odenis_ucun_hold_muddeti_deqiqe_7cd0da')} min={1} max={120} required type="number" value={form.paymentHoldMinutes} onChange={(event) => setForm({ ...form, paymentHoldMinutes: event.target.value })} />
        </div>
        <div className="form-grid two">
          <TextField label={i18n.t('ui.pages.admin.restaurant_edit_page.restoranin_cavab_muddeti_deqiqe_485504')} min={1} max={120} required type="number" value={form.restaurantResponseMinutes} onChange={(event) => setForm({ ...form, restaurantResponseMinutes: event.target.value })} />
        </div>
        <FileUploadField
          label={i18n.t('ui.pages.admin.restaurant_edit_page.restoran_sekli_cb8de8')}
          accept="image/jpeg,image/png,image/webp,image/avif"
          onUploaded={(fileId) => {
            if (fileId) {
              setFileIds((current) => [...current, fileId])
            }
          }}
        />
        {error ? <StatusMessage details={errorDetails} tone="danger">{error}</StatusMessage> : null}
        <div className="form-actions">
          <Button disabled={isSubmitting} type="submit">{isSubmitting ?i18n.t('ui.pages.admin.restaurant_edit_page.saxlanilir_da0933') :i18n.t('ui.pages.admin.restaurant_edit_page.yadda_saxla_78db97')}</Button>
          <ButtonLink to={`/admin/restaurants/${restaurantId}`} variant="secondary">{i18n.t('ui.pages.admin.restaurant_edit_page.legv_et_94727e')}</ButtonLink>
        </div>
      </form>
      <RestaurantSchedulePanel restaurantId={restaurantId} workingHours={restaurant.workingHours}
        onApplied={() => navigate(`/admin/restaurants/${restaurantId}`)} />
      <RestaurantDepositRulesPanel restaurantId={restaurantId} />
    </main>
  )
}
