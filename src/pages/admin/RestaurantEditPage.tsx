import { type FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

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
  })

  useEffect(() => {
    if (!restaurant) {
      return
    }

    setForm({
      location: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email || '',
      restaurantGroupId: restaurant.restaurantGroupId || '',
      restaurantGroupName: restaurant.restaurantGroupName || '',
      restaurantGroupLegalName: '',
      branchName: restaurant.branchName || '',
      depositAmount: String(restaurant.depositAmount),
      cancellationWindowMinutes: String(restaurant.cancellationWindowMinutes ?? 60),
      serviceFeePercent: String(restaurant.defaultServiceFeePercent),
      staffSettlementPeriod: '7',
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
          <TextField label="Məkan" required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          <TextField label="Filial adı" required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} />
        </div>
        <div className="form-grid two">
          <TextField label="Telefon" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <TextField label="Email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <SelectField label="Restoran qrupu" value={form.restaurantGroupId} onChange={(event) => setForm({ ...form, restaurantGroupId: event.target.value })}>
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
        <FileUploadField
          label="Restoran şəkli"
          accept="image/*"
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
