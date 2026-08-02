import { type FormEvent, useEffect, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'

type TablesPageMode = 'list' | 'create'

export function TablesManagementPage({ mode = 'list' }: { mode?: TablesPageMode }) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ tableNo: '', name: '', capacity: '2' })
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const { data: tables, isLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.tables.list(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      return
    }

    await ecafeApi.tables.create(restaurantId, {
      tableNo: form.tableNo,
      name: form.name,
      capacity: Number(form.capacity),
    })
    setForm({ tableNo: '', name: '', capacity: '2' })
    setMessage('Masa yaradıldı.')
    setReloadKey((value) => value + 1)
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={mode === 'create' ? 'Yeni masa' : 'Masalar'}
        action={mode === 'list' ? <ButtonLink to="/admin/tables/new">Yeni masa</ButtonLink> : <ButtonLink to="/admin/tables" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      <section className={mode === 'create' ? 'admin-single-column' : 'admin-resource-layout'}>
        {mode === 'create' ? (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">Yeni masa</span>
              <h2>Masa məlumatları</h2>
            </div>
            <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </SelectField>
            <div className="form-grid two">
              <TextField label="Masa nömrəsi" required value={form.tableNo} onChange={(event) => setForm({ ...form, tableNo: event.target.value })} />
              <TextField label="Ad" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <TextField label="Tutum" min={1} required type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
            <Button type="submit">Masa yarat</Button>
            {message ? <p className="form-message">{message}</p> : null}
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
                  {restaurant.name}
                </option>
              ))}
            </SelectField>
            {isLoading ? <p className="online-only">Masalar yüklənir...</p> : null}
            <div className="compact-list">
              {tables.map((table) => (
                <article key={table.id}>
                  <div>
                    <strong>{table.number}</strong>
                    <small>{table.capacity} nəfər</small>
                  </div>
                  <Badge tone={table.status === 'Available' ? 'success' : 'neutral'}>{table.status}</Badge>
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
