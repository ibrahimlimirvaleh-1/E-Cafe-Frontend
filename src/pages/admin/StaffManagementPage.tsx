import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'

const initialForm = {
  name: '',
  surname: '',
  email: '',
  phone: '',
  password: '',
  roleId: '',
  isActive: 'true',
  serviceFeePercent: '',
}

export function StaffManagementPage() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [fileId, setFileId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(initialForm)

  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const { data: roles } = useAsyncData(() => ecafeApi.lookups.roles(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const { data: staff, isLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.staff.byRestaurant(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )
  const roleOptions = useMemo(() => roles.filter((role) => role.id > 0), [roles])

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !form.roleId) {
      setMessage('Restoran və rol seçilməlidir.')
      return
    }

    await ecafeApi.staff.create({
      name: form.name,
      surname: form.surname,
      email: form.email,
      phone: form.phone,
      password: form.password,
      restaurantId,
      roleId: Number(form.roleId),
      isActive: form.isActive === 'true',
      serviceFeePercent: form.serviceFeePercent ? Number(form.serviceFeePercent) : null,
      fileId,
    })
    setForm(initialForm)
    setFileId(null)
    setMessage('Əməkdaş yaradıldı.')
    setReloadKey((value) => value + 1)
  }

  return (
    <main className="admin-page">
      <PageHeader eyebrow="Admin" title="Personal idarəetməsi" />

      <section className="admin-resource-layout">
        <form className="admin-panel" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">Yeni əməkdaş</span>
            <h2>Əməkdaş məlumatları</h2>
          </div>
          <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </SelectField>
          <div className="form-grid two">
            <TextField label="Ad" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label="Soyad" required value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} />
          </div>
          <TextField label="Email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <div className="form-grid two">
            <TextField label="Telefon" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <TextField label="Parol" required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </div>
          <SelectField label="Rol" required value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
            <option value="">Rol seç</option>
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </SelectField>
          <div className="form-grid two">
            <SelectField label="Status" value={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.value })}>
              <option value="true">Aktiv</option>
              <option value="false">Deaktiv</option>
            </SelectField>
            <TextField
              label="Servis faizi"
              min={0}
              step="0.01"
              type="number"
              value={form.serviceFeePercent}
              onChange={(event) => setForm({ ...form, serviceFeePercent: event.target.value })}
            />
          </div>
          <FileUploadField label="Profil şəkli" onUploaded={setFileId} />
          <Button type="submit">Əməkdaş yarat</Button>
          {message ? <p className="form-message">{message}</p> : null}
        </form>

        <section className="admin-panel">
          <div>
            <span className="eyebrow">Siyahı</span>
            <h2>Restoran personalı</h2>
          </div>
          {isLoading ? <p className="online-only">Personal yüklənir...</p> : null}
          <div className="compact-list">
            {staff.map((member) => (
              <article key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.phone || member.role} · {member.serviceFeePercent == null ? 'Servis faizi yoxdur' : `${member.serviceFeePercent}%`}</small>
                </div>
                <div className="staff-badges">
                  <Badge tone={member.status === 'Active' ? 'success' : 'neutral'}>{member.status === 'Active' ? 'Aktiv' : 'Deaktiv'}</Badge>
                  <Badge tone="info">{member.role}</Badge>
                </div>
              </article>
            ))}
            {!isLoading && staff.length === 0 ? <p className="online-only">Bu restoran üçün personal tapılmadı.</p> : null}
          </div>
        </section>
      </section>
    </main>
  )
}
