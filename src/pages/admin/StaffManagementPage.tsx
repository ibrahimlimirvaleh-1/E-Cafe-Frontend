import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, Info, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Role, StaffMember } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, hasPermission, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ActionIconButton, ActionIconLink } from '../../shared/ui/ActionIconButton'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { RestaurantContextCard, restaurantOptionLabel } from '../../shared/ui/RestaurantContextCard'
import { SafeImage } from '../../shared/ui/SafeImage'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type StaffPageMode = 'list' | 'create' | 'edit'

const initialForm = {
  name: '',
  surname: '',
  email: '',
  phone: '',
  roleId: '',
  isActive: 'true',
  serviceFeePercent: '',
}

const roleIdsByStaffRole: Record<Role, number> = {
  PlatformAdmin: 1,
  Owner: 2,
  Manager: 3,
  Waiter: 4,
  Customer: 5,
  Kitchen: 6,
}

const staffFormGuidance = [
  'Email və telefon aktiv əməkdaşlarda təkrar olmamalıdır.',
  'Telefonu 0501234567 və ya +994501234567 formatında daxil edin.',
  'Profil şəkli seçilirsə, upload tamamlanandan sonra saxlayın.',
  'Şifrə təyin etmə linki əməkdaş yaradıldıqdan sonra emailə göndərilir.',
]

export function StaffManagementPage({ mode = 'list' }: { mode?: StaffPageMode }) {
  const { setSession, user } = useAuth()
  const { staffId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [fileId, setFileId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const [roleSelections, setRoleSelections] = useState<Record<string, string>>({})
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState('')
  const [deactivatingStaffId, setDeactivatingStaffId] = useState('')
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
  const { data: staffDetail } = useAsyncData(
    () => (mode === 'edit' && restaurantId && staffId ? ecafeApi.staff.detail(restaurantId, staffId) : Promise.resolve(null)),
    null,
    [mode, restaurantId, staffId, reloadKey],
  )
  const editingStaff = mode === 'edit' ? staffDetail ?? staff.find((member) => member.id === staffId) : undefined
  const roleOptions = useMemo(
    () => roles.filter((role) => role.id > 0 && role.isStaffAssignable === true),
    [roles],
  )
  const isPlatformAdmin = isInRole(user, [RoleIds.PlatformAdmin])
  const visibleRoleOptions = useMemo(
    () => (isPlatformAdmin ? roleOptions : roleOptions.filter((role) => String(role.id) !== RoleIds.Owner)),
    [isPlatformAdmin, roleOptions],
  )
  const canChangeRoles = isInRole(user, [RoleIds.PlatformAdmin]) || hasPermission(user, 'ManageStaff')
  const cannotEditOwnerStaff = mode === 'edit' && editingStaff ? !canManageStaffMember(editingStaff) : false

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(searchParams.get('restaurantId') || restaurants[0].id)
    }
  }, [restaurants, searchParams, selectedRestaurantId])

  useEffect(() => {
    setRoleSelections(
      staff.reduce<Record<string, string>>((rolesByStaffId, member) => {
        rolesByStaffId[member.id] = String(currentRoleId(member) || '')
        return rolesByStaffId
      }, {}),
    )
  }, [staff])

  useEffect(() => {
    if (mode === 'edit' && editingStaff) {
      const surname = editingStaff.surname || ''
      const firstName = surname && editingStaff.name.endsWith(` ${surname}`)
        ? editingStaff.name.slice(0, -surname.length).trim()
        : editingStaff.name

      setForm({
        name: firstName,
        surname,
        email: editingStaff.email || '',
        phone: editingStaff.phone,
        roleId: String(currentRoleId(editingStaff) || ''),
        isActive: editingStaff.status === 'Inactive' ? 'false' : 'true',
        serviceFeePercent: editingStaff.serviceFeePercent == null ? '' : String(editingStaff.serviceFeePercent),
      })
    }
  }, [editingStaff, mode])

  function currentRoleId(member: StaffMember) {
    return member.roleId || roleIdsByStaffRole[member.role] || 0
  }

  function selectedRoleId(member: StaffMember) {
    return roleSelections[member.id] || String(currentRoleId(member) || '')
  }

  function isStaffAssignableRole(roleId: string) {
    return visibleRoleOptions.some((role) => String(role.id) === roleId)
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

  function isOwnerStaffMember(member: StaffMember) {
    return member.role === 'Owner' || currentRoleId(member) === Number(RoleIds.Owner)
  }

  function canManageStaffMember(member: StaffMember) {
    return isPlatformAdmin || !isOwnerStaffMember(member)
  }

  function setOwnerRestrictionMessage() {
    setMessage('Yalnız platform administratoru sahibkar hesablarını idarə edə bilər.')
    setMessageDetails([])
  }

  function setRoleRestrictionMessage() {
    setMessage('Bu rol restoran personalı üçün seçilə bilməz.')
    setMessageDetails([])
  }

  function fieldError(...fieldNames: string[]) {
    const normalizedNames = fieldNames.map((fieldName) => fieldName.toLowerCase())
    const detail = messageDetails.find((item) => {
      const normalizedField = (item.field || '').replace(/Request\.|Command\./gi, '').toLowerCase()
      return normalizedNames.includes(normalizedField)
    })

    return detail?.message
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationDetails = validateStaffForm(form, restaurantId, mode)

    if (validationDetails.length > 0) {
      setMessage('Əməkdaş məlumatlarında düzəldilməli sahələr var.')
      setMessageDetails(validationDetails)
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      if (mode === 'edit' && staffId) {
        if (editingStaff && !canManageStaffMember(editingStaff)) {
          setOwnerRestrictionMessage()
          return
        }

        await ecafeApi.staff.update(restaurantId, staffId, {
          name: form.name.trim(),
          surname: form.surname.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          isActive: form.isActive === 'true',
          serviceFeePercent: form.serviceFeePercent ? Number(form.serviceFeePercent) : null,
          fileId,
        })
        setMessage('Əməkdaş məlumatları yeniləndi.')
      } else {
        if (!isStaffAssignableRole(form.roleId)) {
          setRoleRestrictionMessage()
          return
        }

        await ecafeApi.staff.create({
          name: form.name.trim(),
          surname: form.surname.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          restaurantId,
          roleId: Number(form.roleId),
          isActive: form.isActive === 'true',
          serviceFeePercent: form.serviceFeePercent ? Number(form.serviceFeePercent) : null,
          fileId,
        })
        setForm(initialForm)
        setFileId(null)
        setMessage('Əməkdaş yaradıldı. Şifrə təyin etmə linki emailə göndərildi.')
      }
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, mode === 'edit' ? 'Əməkdaş yenilənmədi.' : 'Əməkdaş yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  async function handleRoleChange(member: StaffMember) {
    if (!canManageStaffMember(member)) {
      setOwnerRestrictionMessage()
      return
    }

    if (!isStaffAssignableRole(selectedRoleId(member))) {
      setRoleRestrictionMessage()
      return
    }

    const roleId = Number(selectedRoleId(member))
    if (!roleId) {
      setMessage('Rol seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    setUpdatingRoleUserId(member.id)
    try {
      const tokens = await ecafeApi.users.updateRole(member.id, roleId)
      if (tokens.accessToken) {
        setSession(tokens)
      }

      setMessage('Rol yeniləndi.')
      setMessageDetails([])
      setRoleSelections((current) => ({
        ...current,
        [member.id]: String(roleId),
      }))
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Rol yenilənmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    } finally {
      setUpdatingRoleUserId('')
    }
  }

  async function handleDeactivate(member: StaffMember) {
    if (!canManageStaffMember(member)) {
      setOwnerRestrictionMessage()
      return
    }

    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    setDeactivatingStaffId(member.id)
    try {
      await ecafeApi.staff.deactivate(restaurantId, member.id)
      setMessage('Əməkdaş deaktiv edildi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Əməkdaş deaktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    } finally {
      setDeactivatingStaffId('')
    }
  }

  async function handleActivate(member: StaffMember) {
    if (!canManageStaffMember(member)) {
      setOwnerRestrictionMessage()
      return
    }

    if (!restaurantId) {
      setMessage('Restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    setDeactivatingStaffId(member.id)
    try {
      await ecafeApi.staff.activate(restaurantId, member.id)
      setMessage('Əməkdaş aktiv edildi.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Əməkdaş aktiv edilmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    } finally {
      setDeactivatingStaffId('')
    }
  }

  async function handleDelete(member: StaffMember) {
    if (!canManageStaffMember(member)) {
      setOwnerRestrictionMessage()
      return
    }

    setMessage('')
    setMessageDetails([])
    try {
      await ecafeApi.staff.delete(member.id)
      setMessage('Əməkdaş silindi.')
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Əməkdaş silinmədi.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={mode === 'create' ? 'Yeni əməkdaş' : mode === 'edit' ? 'Əməkdaşı redaktə et' : 'Personal'}
        action={mode === 'list' ? <ButtonLink to="/admin/staff/new">Yeni əməkdaş</ButtonLink> : <ButtonLink to="/admin/staff" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      <section className={mode === 'create' || mode === 'edit' ? 'admin-single-column' : 'admin-single-column staff-list-layout'}>
        {mode === 'create' || mode === 'edit' ? (
          cannotEditOwnerStaff ? (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">İcazə</span>
              <h2>Bu əməkdaşı yalnız platform administratoru idarə edə bilər</h2>
            </div>
            <StatusMessage tone="danger">Sahibkar hesabının redaktəsi, deaktiv edilməsi, silinməsi və rol dəyişikliyi yalnız platform administratoruna açıqdır.</StatusMessage>
            <ButtonLink to="/admin/staff" variant="secondary">Siyahıya qayıt</ButtonLink>
          </section>
          ) : (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">{mode === 'edit' ? 'Redaktə' : 'Yeni əməkdaş'}</span>
              <h2>Əməkdaş məlumatları</h2>
            </div>
            {mode === 'create' ? (
              <div className="form-guidance" role="note">
                <span className="form-guidance-icon">
                  <Info size={18} />
                </span>
                <div>
                  <strong>Yaratmazdan əvvəl yoxlayın</strong>
                  <ul>
                    {staffFormGuidance.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <SelectField
              error={fieldError('RestaurantId')}
              label="Restoran"
              required
              value={restaurantId}
              onChange={(event) => setSelectedRestaurantId(event.target.value)}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurantOptionLabel(restaurant)}
                </option>
              ))}
            </SelectField>
            <div className="form-grid two">
              <TextField
                error={fieldError('Name')}
                hint="Ad ən azı 2 simvol olmalıdır."
                label="Ad"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <TextField
                error={fieldError('Surname')}
                hint="Soyad ən azı 2 simvol olmalıdır."
                label="Soyad"
                required
                value={form.surname}
                onChange={(event) => setForm({ ...form, surname: event.target.value })}
              />
            </div>
            <TextField
              error={fieldError('Email')}
              hint="Aktiv əməkdaşlarda təkrar email qəbul edilmir."
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <TextField
              error={fieldError('Phone')}
              hint="Nümunə: 0501234567 və ya +994501234567."
              label="Telefon"
              required
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <SelectField
              disabled={mode === 'edit'}
              error={fieldError('RoleId')}
              hint={mode === 'edit' ? 'Mövcud əməkdaşın rolunu siyahı səhifəsində dəyişin.' : 'Sahibkar rolunu yalnız platform administratoru yarada bilər.'}
              label="Rol"
              required={mode === 'create'}
              value={form.roleId}
              onChange={(event) => setForm({ ...form, roleId: event.target.value })}
            >
              <option value="">Rol seç</option>
              {visibleRoleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </SelectField>
            <div className="form-grid two">
              <SelectField
                error={fieldError('IsActive')}
                label="Status"
                value={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.value })}
              >
                <option value="true">Aktiv</option>
                <option value="false">Deaktiv</option>
              </SelectField>
              <TextField
                error={fieldError('ServiceFeePercent')}
                hint="Boş qalarsa restoran qaydası tətbiq olunur."
                label="Servis faizi"
                min={0}
                step="0.01"
                type="number"
                value={form.serviceFeePercent}
                onChange={(event) => setForm({ ...form, serviceFeePercent: event.target.value })}
              />
            </div>
            <FileUploadField label="Profil şəkli" accept="image/*" onUploaded={setFileId} />
            <Button type="submit">{mode === 'edit' ? 'Yadda saxla' : 'Əməkdaş yarat'}</Button>
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
          </form>
          )
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
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            <div className="compact-list">
              {staff.map((member) => (
                <article className="staff-member-row" key={member.id}>
                  <SafeImage src={member.avatar} alt={member.name} />
                  <div className="staff-member-main">
                    <strong>{member.name || 'Adsız əməkdaş'}</strong>
                    <small>
                      {member.phone || 'Telefon yoxdur'} - {member.serviceFeePercent == null ? 'Servis faizi yoxdur' : `Servis faizi ${member.serviceFeePercent}%`}
                    </small>
                  </div>
                  <div className="staff-badges">
                    <Badge tone={member.status === 'Active' ? 'success' : 'neutral'}>{member.status === 'Active' ? 'Aktiv' : 'Deaktiv'}</Badge>
                    <Badge tone="info">{roleLabel(member.role)}</Badge>
                  </div>
                  {canChangeRoles && canManageStaffMember(member) ? (
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
                        {visibleRoleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <ActionIconButton
                        disabled={updatingRoleUserId === member.id || Number(selectedRoleId(member)) === currentRoleId(member)}
                        label={`${member.name} üçün rolu yenilə`}
                        onClick={() => void handleRoleChange(member)}
                        title={updatingRoleUserId === member.id ? 'Rol yenilənir' : 'Rolu yenilə'}
                      >
                        <RefreshCw size={18} />
                      </ActionIconButton>
                      <ActionIconLink
                        label={`${member.name} əməkdaşını redaktə et`}
                        to={`/admin/staff/${member.id}/edit?restaurantId=${restaurantId}`}
                      >
                        <Pencil size={18} />
                      </ActionIconLink>
                      {member.status === 'Active' ? (
                        <ActionIconButton
                          disabled={deactivatingStaffId === member.id}
                          label={`${member.name} əməkdaşını deaktiv et`}
                          onClick={() => void handleDeactivate(member)}
                          title={deactivatingStaffId === member.id ? 'Deaktiv edilir' : 'Deaktiv et'}
                          tone="danger"
                        >
                          <Ban size={18} />
                        </ActionIconButton>
                      ) : (
                        <ActionIconButton
                          disabled={deactivatingStaffId === member.id}
                          label={`${member.name} əməkdaşını aktiv et`}
                          onClick={() => void handleActivate(member)}
                          title={deactivatingStaffId === member.id ? 'Aktiv edilir' : 'Aktiv et'}
                        >
                          <CheckCircle2 size={18} />
                        </ActionIconButton>
                      )}
                      <ActionIconButton label={`${member.name} əməkdaşını sil`} onClick={() => void handleDelete(member)} tone="danger">
                        <Trash2 size={18} />
                      </ActionIconButton>
                    </div>
                  ) : null}
                </article>
              ))}
              {!isLoading && staff.length === 0 ? <p className="online-only">Bu restoran üçün personal tapılmadı.</p> : null}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

function validateStaffForm(form: typeof initialForm, restaurantId: string, mode: StaffPageMode): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = []
  const email = form.email.trim()
  const phone = form.phone.trim()
  const serviceFee = form.serviceFeePercent ? Number(form.serviceFeePercent) : null

  if (!restaurantId) {
    details.push({ field: 'RestaurantId', label: 'Restoran', message: 'Restoran seçilməlidir.' })
  }

  if (form.name.trim().length < 2) {
    details.push({ field: 'Name', label: 'Ad', message: 'Ad ən azı 2 simvol olmalıdır.' })
  }

  if (form.surname.trim().length < 2) {
    details.push({ field: 'Surname', label: 'Soyad', message: 'Soyad ən azı 2 simvol olmalıdır.' })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.push({ field: 'Email', label: 'Email', message: 'Düzgün email formatı daxil edin.' })
  }

  if (!/^(\+994|0)(50|51|55|70|77|99|10)\d{7}$/.test(phone.replace(/[\s-]/g, ''))) {
    details.push({ field: 'Phone', label: 'Telefon', message: 'Telefonu 0501234567 və ya +994501234567 formatında daxil edin.' })
  }

  if (mode === 'create' && !form.roleId) {
    details.push({ field: 'RoleId', label: 'Rol', message: 'Əməkdaş üçün rol seçilməlidir.' })
  }

  if (serviceFee !== null && (!Number.isFinite(serviceFee) || serviceFee < 0 || serviceFee > 100)) {
    details.push({ field: 'ServiceFeePercent', label: 'Servis faizi', message: 'Servis faizi 0 və 100 arasında olmalıdır.' })
  }

  return details
}

export function StaffCreatePage() {
  return <StaffManagementPage mode="create" />
}
