import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { Role, StaffMember } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, hasPermission, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { RestaurantContextCard, restaurantOptionLabel } from '../../shared/ui/RestaurantContextCard'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type StaffPageMode = 'list' | 'create'

const initialForm = {
  name: '',
  surname: '',
  email: '',
  phone: '',
  password: '',
  roleId: '',
  isActive: 'true',
  serviceFeePercent: '',
  maxActiveTableCount: '',
}

const roleIdsByStaffRole: Record<Role, number> = {
  PlatformAdmin: 1,
  Owner: 2,
  Manager: 3,
  Waiter: 4,
  Customer: 5,
  Kitchen: 6,
}

export function StaffManagementPage({ mode = 'list' }: { mode?: StaffPageMode }) {
  const { setSession, user } = useAuth()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [fileId, setFileId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [roleSelections, setRoleSelections] = useState<Record<string, string>>({})
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState('')
  const [form, setForm] = useState(initialForm)

  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const { data: roles } = useAsyncData(() => ecafeApi.lookups.roles(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === restaurantId)
  const { data: staff, isLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.staff.byRestaurant(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId, reloadKey],
  )
  const roleOptions = useMemo(() => roles.filter((role) => role.id > 0), [roles])
  const canChangeRoles = isInRole(user, [RoleIds.PlatformAdmin]) || hasPermission(user, 'ManageStaff')
  const selectedRoleName = roleOptions.find((role) => String(role.id) === form.roleId)?.name.toLowerCase() || ''
  const isWaiterRoleSelected = selectedRoleName.includes('ofisiant') || selectedRoleName.includes('waiter') || form.roleId === String(roleIdsByStaffRole.Waiter)

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  function currentRoleId(member: StaffMember) {
    return member.roleId || roleIdsByStaffRole[member.role] || 0
  }

  function selectedRoleId(member: StaffMember) {
    return roleSelections[member.id] || String(currentRoleId(member) || '')
  }

  function roleLabel(role: Role) {
    const labels: Record<Role, string> = {
      PlatformAdmin: 'Platforma admini',
      Owner: 'Sahibkar',
      Manager: 'Menecer',
      Waiter: 'Ofisiant',
      Kitchen: 'Mətbəx',
      Customer: 'Müştəri',
    }

    return labels[role] || role
  }

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
      maxActiveTableCount: form.maxActiveTableCount ? Number(form.maxActiveTableCount) : null,
      fileId,
    })
    setForm(initialForm)
    setFileId(null)
    setMessage('Əməkdaş yaradıldı.')
    setReloadKey((value) => value + 1)
  }

  async function handleRoleChange(member: StaffMember) {
    const roleId = Number(selectedRoleId(member))
    if (!roleId) {
      setMessage('Rol seçilməlidir.')
      return
    }

    setMessage('')
    setUpdatingRoleUserId(member.id)
    try {
      const tokens = await ecafeApi.users.updateRole(member.id, roleId)
      if (tokens.accessToken) {
        setSession(tokens)
      }

      setMessage('Rol yeniləndi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Rol yenilənmədi.')
    } finally {
      setUpdatingRoleUserId('')
    }
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={mode === 'create' ? 'Yeni əməkdaş' : 'Personal'}
        action={mode === 'list' ? <ButtonLink to="/admin/staff/new">Yeni əməkdaş</ButtonLink> : <ButtonLink to="/admin/staff" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      <section className={mode === 'create' ? 'admin-single-column' : 'admin-single-column staff-list-layout'}>
        {mode === 'create' ? (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">Yeni əməkdaş</span>
              <h2>Əməkdaş məlumatları</h2>
            </div>
            <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurantOptionLabel(restaurant)}
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
              <TextField label="Servis faizi" min={0} step="0.01" type="number" value={form.serviceFeePercent} onChange={(event) => setForm({ ...form, serviceFeePercent: event.target.value })} />
            </div>
            {isWaiterRoleSelected ? (
              <TextField
                label="Ofisiant aktiv masa limiti"
                min={1}
                type="number"
                value={form.maxActiveTableCount}
                onChange={(event) => setForm({ ...form, maxActiveTableCount: event.target.value })}
              />
            ) : null}
            <FileUploadField label="Profil şəkli" onUploaded={setFileId} />
            <Button type="submit">Əməkdaş yarat</Button>
            {message ? <StatusMessage>{message}</StatusMessage> : null}
          </form>
        ) : (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">Siyahı</span>
              <h2>Restoran personalı</h2>
            </div>
            <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurantOptionLabel(restaurant)}
                </option>
              ))}
            </SelectField>
            {isLoading ? <p className="online-only">Personal yüklənir...</p> : null}
            <RestaurantContextCard restaurant={selectedRestaurant} />
            <div className="compact-list">
              {staff.map((member) => (
                <article className="staff-member-row" key={member.id}>
                  <img src={member.avatar} alt={member.name} />
                  <div className="staff-member-main">
                    <strong>{member.name || 'Adsız əməkdaş'}</strong>
                    <small>
                      {member.phone || 'Telefon yoxdur'} - {member.serviceFeePercent == null ? 'Servis faizi yoxdur' : `Servis faizi ${member.serviceFeePercent}%`}
                    </small>
                    {member.role === 'Waiter' ? (
                      <small className="staff-capacity">
                        Masa yükü: {member.activeTableSessionCount ?? 0}/{member.effectiveMaxActiveTableCount ?? 'limitsiz'}
                      </small>
                    ) : null}
                  </div>
                  <div className="staff-badges">
                    <Badge tone={member.status === 'Active' ? 'success' : 'neutral'}>{member.status === 'Active' ? 'Aktiv' : 'Deaktiv'}</Badge>
                    <Badge tone="info">{roleLabel(member.role)}</Badge>
                  </div>
                  {canChangeRoles ? (
                    <div className="staff-role-actions">
                      <select
                        aria-label={`${member.name} üçün rol`}
                        value={selectedRoleId(member)}
                        onChange={(event) =>
                          setRoleSelections((current) => ({
                            ...current,
                            [member.id]: event.target.value,
                          }))
                        }
                      >
                        {roleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <Button disabled={updatingRoleUserId === member.id || Number(selectedRoleId(member)) === currentRoleId(member)} onClick={() => void handleRoleChange(member)} type="button" variant="secondary">
                        {updatingRoleUserId === member.id ? 'Yenilənir...' : 'Rolu yenilə'}
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
              {!isLoading && staff.length === 0 ? <p className="online-only">Bu restoran üçün personal tapılmadı.</p> : null}
            </div>
            {message ? <StatusMessage>{message}</StatusMessage> : null}
          </section>
        )}
      </section>
    </main>
  )
}

export function StaffCreatePage() {
  return <StaffManagementPage mode="create" />
}
