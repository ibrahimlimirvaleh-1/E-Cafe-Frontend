import { type FormEvent, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { restaurantRow } from '../../shared/api/mappers'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { DataTable } from '../../shared/ui/DataTable'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'

export function RestaurantManagementPage() {
  const [reloadKey, setReloadKey] = useState(0)
  const [fileIds, setFileIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    name: '',
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
  const { data: restaurants, isLoading } = useAsyncData(() => ecafeApi.restaurants.list(), [], [reloadKey])
  const { data: groups } = useAsyncData(() => ecafeApi.restaurantGroups.list(), [], [reloadKey])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    await ecafeApi.restaurants.create({
      name: form.name,
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
      fileIds,
    })
    setForm({
      name: '',
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
    setFileIds([])
    setMessage('Restoran yaradıldı.')
    setReloadKey((value) => value + 1)
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Restoranlar"
        description="Yeni restoran və filial yaradılır, mövcud qrup seçilə və ya yeni qrup məlumatları create request-də göndərilə bilər."
      />

      <section className="admin-resource-layout">
        <form className="admin-panel" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">Yeni restoran</span>
            <h2>Profil və filial</h2>
          </div>
          <TextField label="Restoran adı" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <div className="form-grid two">
            <TextField label="Məkan" required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            <TextField label="Filial adı" value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} />
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
          <FileUploadField
            label="Restoran şəkli"
            onUploaded={(fileId) => {
              if (fileId) {
                setFileIds((current) => [...current, fileId])
              }
            }}
          />
          <Button type="submit">Restoran yarat</Button>
          {message ? <p className="form-message">{message}</p> : null}
        </form>

        <section>
          {isLoading ? <p className="online-only">Restoranlar yüklənir...</p> : null}
          <DataTable baseRoute="/admin/restaurants" columns={['Restoran', 'Status', 'Müqavilə', 'Depozit']} rows={restaurants.map(restaurantRow)} />
        </section>
      </section>
    </main>
  )
}
