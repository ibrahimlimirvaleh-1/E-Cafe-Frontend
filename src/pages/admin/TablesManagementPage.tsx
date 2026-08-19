import { CheckCircle2, Pencil, Trash2, UserX } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ActionIconButton, ActionIconLink } from '../../shared/ui/ActionIconButton'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { RestaurantContextCard, restaurantOptionLabel } from '../../shared/ui/RestaurantContextCard'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type TablesPageMode = 'list' | 'create' | 'edit'

export function TablesManagementPage({ mode = 'list' }: { mode?: TablesPageMode }) {
  const { tableId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [form, setForm] = useState({ tableNo: '', name: '', capacity: '2' })
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === restaurantId)
  const { data: tables, isLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.tables.list(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )
  const editingTable = mode === 'edit' ? tables.find((table) => table.id === tableId) : undefined

  function tableStatusLabel(status: string) {
    const labels: Record<string, string> = {
      Available: 'Boşdur',
      Occupied: 'Dolu',
      Reserved: 'Rezervdir',
      Hidden: 'Gizlidir',
    }

    return labels[status] || status
  }

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(searchParams.get('restaurantId') || restaurants[0].id)
    }
  }, [restaurants, searchParams, selectedRestaurantId])

  useEffect(() => {
    if (mode === 'edit' && editingTable) {
      setForm({
        tableNo: editingTable.number,
        name: editingTable.name || editingTable.number,
        capacity: String(editingTable.capacity),
      })
    }
  }, [editingTable, mode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      if (mode === 'edit' && tableId) {
        await ecafeApi.tables.update(restaurantId, tableId, {
          tableNo: form.tableNo,
          name: form.name,
          capacity: Number(form.capacity),
          isActive: true,
        })
        setMessage('Masa məlumatları yeniləndi.')
      } else {
        await ecafeApi.tables.create(restaurantId, {
          tableNo: form.tableNo,
          name: form.name,
          capacity: Number(form.capacity),
        })
        setForm({ tableNo: '', name: '', capacity: '2' })
        setMessage('Masa yaradıldı.')
      }
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, mode === 'edit' ? 'Masa yenilənmədi.' : 'Masa yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDeactivate(targetTableId: string) {
    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.tables.deactivate(restaurantId, targetTableId)
      setMessage('Masa deaktiv edildi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Masa deaktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleActivate(targetTableId: string) {
    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.tables.activate(restaurantId, targetTableId)
      setMessage('Masa aktiv edildi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Masa aktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleDelete(targetTableId: string) {
    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.tables.delete(restaurantId, targetTableId)
      setMessage('Masa silindi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Masa silinmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={mode === 'create' ? 'Yeni masa' : mode === 'edit' ? 'Masanı redaktə et' : 'Masalar'}
        action={mode === 'list' ? <ButtonLink to="/admin/tables/new">Yeni masa</ButtonLink> : <ButtonLink to="/admin/tables" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      <section className={mode === 'create' || mode === 'edit' ? 'admin-single-column' : 'admin-single-column staff-list-layout'}>
        {mode === 'create' || mode === 'edit' ? (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">{mode === 'edit' ? 'Redaktə' : 'Yeni masa'}</span>
              <h2>{mode === 'edit' ? 'Masa məlumatlarını yenilə' : 'Masa məlumatları'}</h2>
            </div>
            <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurantOptionLabel(restaurant)}
                </option>
              ))}
            </SelectField>
            <div className="form-grid two">
              <TextField label="Masa nömrəsi" required value={form.tableNo} onChange={(event) => setForm({ ...form, tableNo: event.target.value })} />
              <TextField label="Ad" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <TextField label="Tutum" min={1} required type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
            <Button type="submit">{mode === 'edit' ? 'Yadda saxla' : 'Masa yarat'}</Button>
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
          </form>
        ) : (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">Siyahı</span>
              <h2>Mövcud masalar</h2>
            </div>
            <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurantOptionLabel(restaurant)}
                </option>
              ))}
            </SelectField>
            {isLoading ? <p className="online-only">Masalar yüklənir...</p> : null}
            <RestaurantContextCard restaurant={selectedRestaurant} />
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            <div className="compact-list">
              {tables.map((table) => (
                <article className="table-management-row" key={table.id}>
                  <div className="table-management-info">
                    <span>
                      <small>Masa nömrəsi</small>
                      <strong>{table.number}</strong>
                    </span>
                    <span>
                      <small>Ad</small>
                      <strong>{table.name || '-'}</strong>
                    </span>
                    <span>
                      <small>Tutum</small>
                      <strong>{table.capacity} nəfər</strong>
                    </span>
                  </div>
                  <Badge tone={table.status === 'Available' ? 'success' : table.status === 'Occupied' ? 'warning' : 'neutral'}>
                    {tableStatusLabel(table.status)}
                  </Badge>
                  <div className="inline-actions">
                    <ActionIconLink label={`${table.number} masasını redaktə et`} to={`/admin/tables/${table.id}/edit?restaurantId=${restaurantId}`}>
                      <Pencil size={18} />
                    </ActionIconLink>
                    {table.isActive ? (
                      <ActionIconButton label={`${table.number} masasını deaktiv et`} onClick={() => void handleDeactivate(table.id)}>
                        <UserX size={18} />
                      </ActionIconButton>
                    ) : (
                      <ActionIconButton label={`${table.number} masasını aktiv et`} onClick={() => void handleActivate(table.id)}>
                        <CheckCircle2 size={18} />
                      </ActionIconButton>
                    )}
                    <ActionIconButton label={`${table.number} masasını sil`} onClick={() => void handleDelete(table.id)} tone="danger">
                      <Trash2 size={18} />
                    </ActionIconButton>
                  </div>
                </article>
              ))}
              {!isLoading && tables.length === 0 ? <p className="online-only">Bu restoran üçün masa yoxdur.</p> : null}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export function TableCreatePage() {
  return <TablesManagementPage mode="create" />
}
