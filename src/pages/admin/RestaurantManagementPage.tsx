import { CheckCircle2, MapPin, Search } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ecafeApi, type GeocodeAddressResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { restaurantRow } from '../../shared/api/mappers'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { DataTable } from '../../shared/ui/DataTable'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type RestaurantPageMode = 'list' | 'create'

const initialForm = {
  location: '',
  latitude: '',
  longitude: '',
  placeId: '',
  geocodedAddress: '',
  phone: '',
  email: '',
  restaurantGroupId: '',
  restaurantGroupName: '',
  restaurantGroupLegalName: '',
  branchName: '',
  depositAmount: '0',
  cancellationWindowMinutes: '60',
  serviceFeePercent: '0',
  staffSettlementPeriod: '7',
  ownerId: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerFirstName: '',
  ownerLastName: '',
}

const defaultPageSize = 10

export function RestaurantManagementPage({ mode = 'list' }: { mode?: RestaurantPageMode }) {
  const { user } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [search, setSearch] = useState('')
  const [fileIds, setFileIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [form, setForm] = useState(initialForm)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [locationResults, setLocationResults] = useState<GeocodeAddressResponse[]>([])
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
  const { data: restaurantPage, isLoading } = useAsyncData(() => ecafeApi.restaurants.page(query), {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }, [query, reloadKey])
  const { data: groups } = useAsyncData(() => ecafeApi.restaurantGroups.list(), [], [reloadKey])
  const canCreateRestaurants = isInRole(user, [RoleIds.PlatformAdmin])
  const canSearchRestaurants = isInRole(user, [RoleIds.PlatformAdmin])
  const pageTitle = mode === 'create' ? 'Yeni restoran' : canSearchRestaurants ? 'Restoranlar' : 'Restoran'

  if (mode === 'create' && !canCreateRestaurants) {
    return <Navigate to="/admin/restaurants" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageDetails([])

    if (!form.latitude || !form.longitude) {
      setMessage('Məkanı xəritə axtarışından seçin.')
      setMessageDetails([{ label: 'Məkan', message: 'Ünvanı yazdıqdan sonra "Xəritədə axtar" düyməsinə basın və uyğun nəticəni seçin.' }])
      return
    }

    try {
      await ecafeApi.restaurants.create({
        location: form.location,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        placeId: form.placeId || null,
        phone: form.phone,
        email: form.email,
        restaurantGroupId: form.restaurantGroupId || undefined,
        restaurantGroupName: form.restaurantGroupId ? undefined : form.restaurantGroupName,
        restaurantGroupLegalName: form.restaurantGroupId ? undefined : form.restaurantGroupLegalName,
        branchName: form.branchName,
        depositAmount: Number(form.depositAmount),
        cancellationWindowMinutes: Number(form.cancellationWindowMinutes),
        serviceFeePercent: Number(form.serviceFeePercent),
        staffSettlementPeriod: Number(form.staffSettlementPeriod),
        defaultWaiterTableLimit: null,
        owner: {
          id: form.ownerId || null,
          searchText: form.ownerEmail || null,
          email: form.ownerEmail || null,
          phone: form.ownerPhone || null,
          firstName: form.ownerFirstName || null,
          lastName: form.ownerLastName || null,
        },
        fileIds,
      })
      setForm(initialForm)
      setFileIds([])
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
      const results = await ecafeApi.restaurants.geocode(form.location)
      setLocationResults(results)
      setMessage(results.length > 1 ? 'Uyğun məkanı seçin.' : 'Məkan xəritədə tapıldı. Davam etmək üçün nəticəni seçin.')
      setMessageDetails([])
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Məkan xəritədə tapılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
      setForm((current) => ({ ...current, latitude: '', longitude: '', placeId: '', geocodedAddress: '' }))
    } finally {
      setIsGeocoding(false)
    }
  }

  function handleLocationChange(value: string) {
    setForm({ ...form, location: value, latitude: '', longitude: '', placeId: '', geocodedAddress: '' })
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
    }))
    setLocationResults([])
    setMessage('Məkan seçildi.')
    setMessageDetails([{ label: 'Seçilmiş məkan', message: result.displayName }])
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={pageTitle}
        action={
          mode === 'create' ? (
            <ButtonLink to="/admin/restaurants" variant="secondary">Siyahıya qayıt</ButtonLink>
          ) : canCreateRestaurants ? (
            <ButtonLink to="/admin/restaurants/new">Yeni restoran</ButtonLink>
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
                  placeholder="Restoran, filial və ya məkan üzrə axtar..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPageNumber(1)
                  }}
                />
              </label>
              <span>{restaurantPage.totalCount} restoran</span>
            </section>
          ) : null}
          {isLoading ? <p className="online-only">Restoranlar yüklənir...</p> : null}
          <DataTable
            baseRoute="/admin/restaurants"
            canEdit={canCreateRestaurants}
            columns={['Restoran', 'Status', 'Müqavilə', 'Depozit']}
            rows={restaurantPage.items.map(restaurantRow)}
          />
          {canSearchRestaurants ? (
            <PaginationControls
              ariaLabel="Admin restoran səhifələmə"
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
            <span className="eyebrow">Yeni restoran</span>
            <h2>Profil və filial</h2>
          </div>
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
                {isGeocoding ? 'Axtarılır...' : 'Xəritədə axtar'}
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
              ) : null}
            </div>
            <TextField label="Filial adı" required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} />
          </div>
          <div className="form-grid two">
            <TextField label="Telefon" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <TextField label="Email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <SelectField
            label="Mövcud restoran qrupu"
            value={form.restaurantGroupId}
            onChange={(event) => setForm({ ...form, restaurantGroupId: event.target.value })}
            hint="Boş qalsa aşağıdakı qrup adı ilə yeni qrup yaradılır."
          >
            <option value="">Yeni qrup yarat</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </SelectField>
          {!form.restaurantGroupId ? (
            <div className="form-grid two">
              <TextField label="Yeni qrup adı" value={form.restaurantGroupName} onChange={(event) => setForm({ ...form, restaurantGroupName: event.target.value })} />
              <TextField label="Yeni qrup legal adı" value={form.restaurantGroupLegalName} onChange={(event) => setForm({ ...form, restaurantGroupLegalName: event.target.value })} />
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
          <div>
            <span className="eyebrow">Sahibkar</span>
            <h2>Sahibkar məlumatları</h2>
            <p className="form-helper">Mövcud sahibkarın emailini daxil edin. Email sistemdə yoxdursa, aşağıdakı məlumatlarla yeni sahibkar yaradılacaq.</p>
          </div>
          <div className="form-grid two">
            <TextField label="Mövcud sahibkar ID" min={1} type="number" value={form.ownerId} onChange={(event) => setForm({ ...form, ownerId: event.target.value })} />
            <TextField label="Sahibkar email" required type="email" value={form.ownerEmail} onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })} />
          </div>
          <div className="form-grid three">
            <TextField label="Yeni sahibkar adı" value={form.ownerFirstName} onChange={(event) => setForm({ ...form, ownerFirstName: event.target.value })} />
            <TextField label="Yeni sahibkar soyadı" value={form.ownerLastName} onChange={(event) => setForm({ ...form, ownerLastName: event.target.value })} />
            <TextField label="Yeni sahibkar telefonu" value={form.ownerPhone} onChange={(event) => setForm({ ...form, ownerPhone: event.target.value })} />
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
          <Button type="submit">Restoran yarat</Button>
          {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
        </form>
      )}
    </main>
  )
}

export function RestaurantCreatePage() {
  return <RestaurantManagementPage mode="create" />
}
