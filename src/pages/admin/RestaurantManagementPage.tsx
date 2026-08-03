import { Search } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { restaurantRow } from '../../shared/api/mappers'
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
}

const pageSize = 20

export function RestaurantManagementPage({ mode = 'list' }: { mode?: RestaurantPageMode }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [search, setSearch] = useState('')
  const [fileIds, setFileIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(initialForm)
  const query = useMemo(() => {
    const params = new URLSearchParams({
      pageNumber: String(pageNumber),
      pageSize: String(pageSize),
    })

    if (search.trim()) {
      params.set('search', search.trim())
    }

    return `?${params.toString()}`
  }, [pageNumber, search])
  const { data: restaurantPage, isLoading } = useAsyncData(() => ecafeApi.restaurants.page(query), {
    items: [],
    pageIndex: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }, [query, reloadKey])
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
    setForm(initialForm)
    setFileIds([])
    setMessage('Restoran yaradıldı.')
    setReloadKey((value) => value + 1)
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={mode === 'create' ? 'Yeni restoran' : 'Restoranlar'}
        action={mode === 'list' ? <ButtonLink to="/admin/restaurants/new">Yeni restoran</ButtonLink> : <ButtonLink to="/admin/restaurants" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      {mode === 'list' ? (
        <section>
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
          {isLoading ? <p className="online-only">Restoranlar yüklənir...</p> : null}
          <DataTable baseRoute="/admin/restaurants" columns={['Restoran', 'Status', 'Müqavilə', 'Depozit']} rows={restaurantPage.items.map(restaurantRow)} />
          <PaginationControls
            ariaLabel="Admin restoran səhifələmə"
            hasNextPage={restaurantPage.hasNextPage}
            hasPreviousPage={restaurantPage.hasPreviousPage}
            pageIndex={restaurantPage.pageIndex}
            totalPages={restaurantPage.totalPages}
            onPageChange={setPageNumber}
          />
        </section>
      ) : (
        <form className="admin-panel admin-single-column" onSubmit={handleSubmit}>
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
          {message ? <StatusMessage>{message}</StatusMessage> : null}
        </form>
      )}
    </main>
  )
}

export function RestaurantCreatePage() {
  return <RestaurantManagementPage mode="create" />
}
