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
import { WorkingHoursField, createDefaultWorkingHours } from '../../shared/ui/WorkingHoursField'

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
  const canEditRestaurants = isInRole(user, [RoleIds.PlatformAdmin])
  const { data: restaurant, isLoading } = useAsyncData(() => ecafeApi.restaurants.adminDetail(restaurantId), null, [restaurantId])
  const { data: groups } = useAsyncData(() => ecafeApi.restaurantGroups.list(), [])
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
    depositAmount: '0',
    cancellationWindowMinutes: '60',
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
      depositAmount: String(restaurant.depositAmount),
      cancellationWindowMinutes: String(restaurant.cancellationWindowMinutes ?? 60),
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
        restaurantGroupId: form.restaurantGroupId || undefined,
        restaurantGroupName: form.restaurantGroupId ? undefined : form.restaurantGroupName,
        restaurantGroupLegalName: form.restaurantGroupId ? undefined : form.restaurantGroupLegalName,
        restaurantGroupEmail: form.restaurantGroupId ? undefined : form.restaurantGroupEmail,
        branchName: form.branchName,
        depositAmount: Number(form.depositAmount),
        cancellationWindowMinutes: Number(form.cancellationWindowMinutes),
        serviceFeePercent: Number(form.serviceFeePercent),
        staffSettlementPeriod: Number(form.staffSettlementPeriod),
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
        <p className="online-only">Restoran məlumatları yüklənir...</p>
      </main>
    )
  }

  return (
    <main className="admin-page narrow">
      <PageHeader eyebrow="Restoran redaktəsi" title={restaurant.name} />

      <form className="admin-panel" onSubmit={handleSubmit}>
        <div className="form-grid two">
          <div className="location-lookup-field">
            <TextField
              label="Məkan"
              required
              value={form.location}
              onChange={(event) => handleLocationChange(event.target.value)}
            />
            <Button disabled={isGeocoding || !form.location.trim()} type="button" variant="secondary" onClick={handleGeocode}>
              <MapPin size={17} />
              {isGeocoding ? 'Axtarılır...' : 'Xəritədə təsdiqlə'}
            </Button>
            {locationResults.length > 0 ? (
              <div className="location-results" role="listbox" aria-label="Xəritə nəticələri">
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
                Seçilmiş məkan: {form.geocodedAddress}
              </small>
            ) : form.location.trim() ? (
              <small className="field-hint unverified-location-hint">
                <AlertTriangle size={14} />
                Ünvan xəritədə təsdiqlənməyib. Restoran saxlanıla bilər, public xəritə ünvanla açılacaq, amma pin dəqiq olmaya bilər.
              </small>
            ) : null}
          </div>
          <TextField label="Filial adı" required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} />
        </div>
        <div className="form-grid two">
          <PhoneField label="Telefon" required value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        </div>
        <WorkingHoursField value={form.workingHours} onChange={(workingHours) => setForm({ ...form, workingHours })} />
        <SelectField label="Restoran qrupu" value={form.restaurantGroupId} onChange={(event) => setForm({ ...form, restaurantGroupId: event.target.value, restaurantGroupEmail: '' })}>
          <option value="">Yeni qrup yarat</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </SelectField>
        {!form.restaurantGroupId ? (
          <div className="form-grid two">
            <TextField label="Yeni qrup adı" required value={form.restaurantGroupName} onChange={(event) => setForm({ ...form, restaurantGroupName: event.target.value })} />
            <TextField label="Yeni qrup legal adı" value={form.restaurantGroupLegalName} onChange={(event) => setForm({ ...form, restaurantGroupLegalName: event.target.value })} />
            <TextField
              label="Qrup əlaqə emaili"
              required
              type="email"
              value={form.restaurantGroupEmail}
              onChange={(event) => setForm({ ...form, restaurantGroupEmail: event.target.value })}
            />
          </div>
        ) : null}
        <div className="form-grid two">
          <TextField label="Depozit" min={0} required step="0.01" type="number" value={form.depositAmount} onChange={(event) => setForm({ ...form, depositAmount: event.target.value })} />
          <TextField label="Servis faizi" min={0} required step="0.01" type="number" value={form.serviceFeePercent} onChange={(event) => setForm({ ...form, serviceFeePercent: event.target.value })} />
        </div>
        <div className="form-grid two">
          <TextField label="Ləğv pəncərəsi dəqiqə" min={0} required type="number" value={form.cancellationWindowMinutes} onChange={(event) => setForm({ ...form, cancellationWindowMinutes: event.target.value })} />
          <TextField label="Personal hesablaşma günü" min={1} required type="number" value={form.staffSettlementPeriod} onChange={(event) => setForm({ ...form, staffSettlementPeriod: event.target.value })} />
        </div>
        <FileUploadField
          label="Restoran şəkli"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onUploaded={(fileId) => {
            if (fileId) {
              setFileIds((current) => [...current, fileId])
            }
          }}
        />
        {error ? <StatusMessage details={errorDetails} tone="danger">{error}</StatusMessage> : null}
        <div className="form-actions">
          <Button disabled={isSubmitting} type="submit">{isSubmitting ? 'Saxlanılır...' : 'Yadda saxla'}</Button>
          <ButtonLink to={`/admin/restaurants/${restaurantId}`} variant="secondary">Ləğv et</ButtonLink>
        </div>
      </form>
    </main>
  )
}
