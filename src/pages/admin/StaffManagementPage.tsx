import { i18n } from '../../shared/i18n/i18n'
import { roleLabel } from '../../shared/i18n/roleLabel'
import { useTranslation } from 'react-i18next'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, Info, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Role, StaffMember } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { getUserFromToken } from '../../shared/auth/jwt'
import { RoleIds, getAccessibleItems, hasPermission, isInRole } from '../../shared/auth/authz'
import { useAsyncData, useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { ActionIconButton, ActionIconLink } from '../../shared/ui/ActionIconButton'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { EmptyState } from '../../shared/ui/EmptyState'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PhoneField } from '../../shared/ui/PhoneField'
import { RestaurantContextCard } from '../../shared/ui/RestaurantContextCard'
import { RestaurantSelectField } from '../../shared/ui/RestaurantSelectField'
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
  'Telefon üçün operator kodunu seçin və 7 rəqəmli nömrəni daxil edin.',
  'Profil şəkli seçilirsə, upload tamamlanandan sonra saxlayın.',
  'Şifrə təyin etmə linki əməkdaş yaradıldıqdan sonra emailə göndərilir.',
]

export function StaffManagementPage({ mode = 'list' }: { mode?: StaffPageMode }) {
  useTranslation()
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
  const accessibleRestaurants = useMemo(() => getAccessibleItems(user, restaurants), [restaurants, user])
  const restaurantId = accessibleRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId) ? selectedRestaurantId : ''
  const selectedRestaurant = accessibleRestaurants.find((restaurant) => restaurant.id === restaurantId)
  const restaurantQuery = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''
  const createStaffPath = `/admin/staff/new${restaurantQuery}`
  const staffListPath = `/admin/staff${restaurantQuery}`
  const { data: staff, isLoading } = useKeyedAsyncData(
    () => (restaurantId ? ecafeApi.staff.byRestaurant(restaurantId) : Promise.resolve([])),
    [],
    restaurantId,
    [restaurantId, reloadKey],
  )
  const { data: staffDetail } = useKeyedAsyncData(
    () => (mode === 'edit' && restaurantId && staffId ? ecafeApi.staff.detail(restaurantId, staffId) : Promise.resolve(null)),
    null,
    `${mode}:${restaurantId}:${staffId}`,
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
    const restaurantIdFromUrl = searchParams.get('restaurantId')
    if (!selectedRestaurantId && restaurantIdFromUrl && accessibleRestaurants.some((restaurant) => restaurant.id === restaurantIdFromUrl)) {
      setSelectedRestaurantId(restaurantIdFromUrl)
      return
    }

    if (!selectedRestaurantId && accessibleRestaurants.length === 1) {
      setSelectedRestaurantId(accessibleRestaurants[0].id)
    }
  }, [accessibleRestaurants, searchParams, selectedRestaurantId])

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

    const targetRestaurantId = Number(restaurantId)
    if (!Number.isSafeInteger(targetRestaurantId) || targetRestaurantId <= 0 || member.restaurantId !== restaurantId) {
      setMessage('Rol dəyişikliyi üçün düzgün restoran seçilməlidir.')
      setMessageDetails([])
      return
    }

    setMessage('')
    setMessageDetails([])
    setUpdatingRoleUserId(member.id)
    try {
      const tokens = await ecafeApi.users.updateRole(member.id, roleId, String(targetRestaurantId))
      if (tokens.accessToken && member.id === user?.userId && getUserFromToken(tokens.accessToken)?.userId === user.userId) {
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
        eyebrow={i18n.t('ui.pages.admin.staff_management_page.admin_c1c224')}
        title={mode === 'create' ?i18n.t('ui.pages.admin.staff_management_page.yeni_emekdas_70d695') : mode === 'edit' ?i18n.t('ui.pages.admin.staff_management_page.emekdasi_redakte_et_d722fb') :i18n.t('ui.pages.admin.staff_management_page.personal_845f92')}
        action={mode === 'list' ? <ButtonLink to={createStaffPath}>{i18n.t('ui.pages.admin.staff_management_page.yeni_emekdas_70d695')}</ButtonLink> : <ButtonLink to={staffListPath} variant="secondary">{i18n.t('ui.pages.admin.staff_management_page.siyahiya_qayit_f779ce')}</ButtonLink>}
      />

      <section className={mode === 'create' || mode === 'edit' ? 'admin-single-column' : 'admin-single-column staff-list-layout'}>
        {mode === 'create' || mode === 'edit' ? (
          cannotEditOwnerStaff ? (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">{i18n.t('ui.pages.admin.staff_management_page.icaze_616fbf')}</span>
              <h2>{i18n.t('ui.pages.admin.staff_management_page.bu_emekdasi_yalniz_platform_administra_f25a64')}</h2>
            </div>
            <StatusMessage tone="danger">{i18n.t('ui.pages.admin.staff_management_page.sahibkar_hesabinin_redaktesi_deaktiv_e_514ab4')}</StatusMessage>
            <ButtonLink to={staffListPath} variant="secondary">{i18n.t('ui.pages.admin.staff_management_page.siyahiya_qayit_f779ce')}</ButtonLink>
          </section>
          ) : (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">{mode === 'edit' ?i18n.t('ui.pages.admin.staff_management_page.redakte_af7c03') :i18n.t('ui.pages.admin.staff_management_page.yeni_emekdas_70d695')}</span>
              <h2>{i18n.t('ui.pages.admin.staff_management_page.emekdas_melumatlari_0cf77c')}</h2>
            </div>
            {mode === 'create' ? (
              <div className="form-guidance" role="note">
                <span className="form-guidance-icon">
                  <Info size={18} />
                </span>
                <div>
                  <strong>{i18n.t('ui.pages.admin.staff_management_page.yaratmazdan_evvel_yoxlayin_136fa1')}</strong>
                  <ul>
                    {staffFormGuidance.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <RestaurantSelectField
              emptyOption={null}
              error={fieldError('RestaurantId')}
              label={i18n.t('ui.pages.admin.staff_management_page.restoran_c4df56')}
              onChange={setSelectedRestaurantId}
              required
              restaurants={accessibleRestaurants}
              value={restaurantId}
            />
            <div className="form-grid two">
              <TextField
                error={fieldError('Name')}
                hint={i18n.t('ui.pages.admin.staff_management_page.ad_en_azi_2_simvol_olmalidir_2b925a')}
                label={i18n.t('ui.pages.admin.staff_management_page.ad_1d97c9')}
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <TextField
                error={fieldError('Surname')}
                hint={i18n.t('ui.pages.admin.staff_management_page.soyad_en_azi_2_simvol_olmalidir_c70ac4')}
                label={i18n.t('ui.pages.admin.staff_management_page.soyad_3d89d4')}
                required
                value={form.surname}
                onChange={(event) => setForm({ ...form, surname: event.target.value })}
              />
            </div>
            <TextField
              error={fieldError('Email')}
              hint={i18n.t('ui.pages.admin.staff_management_page.aktiv_emekdaslarda_tekrar_email_qebul__cf6fe1')}
              label={i18n.t('ui.pages.admin.staff_management_page.email_969ccb')}
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <PhoneField
              error={fieldError('Phone')}
              hint={i18n.t('ui.pages.admin.staff_management_page.numune_994_50_1234567_0a83b0')}
              label={i18n.t('ui.pages.admin.staff_management_page.telefon_fa6906')}
              required
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
            />
            {mode === 'create' ? (
              <SelectField
                error={fieldError('RoleId')}
                hint={i18n.t('ui.pages.admin.staff_management_page.sahibkar_rolunu_yalniz_platform_admini_74d44b')}
                label={i18n.t('ui.pages.admin.staff_management_page.rol_fb9f51')}
                required
                value={form.roleId}
                onChange={(event) => setForm({ ...form, roleId: event.target.value })}
              >
                <option value="">{i18n.t('ui.pages.admin.staff_management_page.rol_sec_8ee490')}</option>
                {visibleRoleOptions.map((role) => (
                  <option key={role.id} value={role.id}>
                    {roleLabel(role.id, role.name)}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <div className="form-grid two">
              <SelectField
                error={fieldError('IsActive')}
                label={i18n.t('ui.pages.admin.staff_management_page.status_920e41')}
                value={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.value })}
              >
                <option value="true">{i18n.t('ui.pages.admin.staff_management_page.aktiv_816345')}</option>
                <option value="false">{i18n.t('ui.pages.admin.staff_management_page.deaktiv_477e77')}</option>
              </SelectField>
              <TextField
                error={fieldError('ServiceFeePercent')}
                hint={i18n.t('ui.pages.admin.staff_management_page.bos_qalarsa_restoran_qaydasi_tetbiq_ol_f5944c')}
                label={i18n.t('ui.pages.admin.staff_management_page.servis_faizi_176e69')}
                min={0}
                step="0.01"
                type="number"
                value={form.serviceFeePercent}
                onChange={(event) => setForm({ ...form, serviceFeePercent: event.target.value })}
              />
            </div>
            <FileUploadField label={i18n.t('ui.pages.admin.staff_management_page.profil_sekli_dba45b')} accept="image/jpeg,image/png,image/webp,image/avif" onUploaded={setFileId} />
            <Button type="submit">{mode === 'edit' ?i18n.t('ui.pages.admin.staff_management_page.yadda_saxla_78db97') :i18n.t('ui.pages.admin.staff_management_page.emekdas_yarat_8d233e')}</Button>
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
          </form>
          )
        ) : (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">{i18n.t('ui.pages.admin.staff_management_page.siyahi_3d2d8b')}</span>
              <h2>{i18n.t('ui.pages.admin.staff_management_page.restoran_personali_da7524')}</h2>
            </div>
            <RestaurantSelectField emptyOption={null} label={i18n.t('ui.pages.admin.staff_management_page.restoran_c4df56')} onChange={setSelectedRestaurantId} required restaurants={accessibleRestaurants} value={restaurantId} />
            {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.staff_management_page.personal_yuklenir_383ded')}</p> : null}
            {selectedRestaurant ? (
              <RestaurantContextCard restaurant={selectedRestaurant} />
            ) : (
              <EmptyState title={i18n.t('ui.pages.admin.staff_management_page.restoran_secilmeyib_63199c')} message={i18n.t('ui.pages.admin.staff_management_page.personal_siyahisini_gormek_ucun_evvelc_861069')} />
            )}
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
            <div className="compact-list">
              {staff.map((member) => (
                <article className="staff-member-row" key={member.id}>
                  <SafeImage src={member.avatar} alt={member.name} />
                  <div className="staff-member-main">
                    <strong>{member.name || 'Adsız əməkdaş'}</strong>
                    <small>
                      {member.phone || 'Telefon yoxdur'} - {member.serviceFeePercent == null ?i18n.t('ui.pages.admin.staff_management_page.servis_faizi_yoxdur_5ee835') : `Servis faizi ${member.serviceFeePercent}%`}
                    </small>
                  </div>
                  <div className="staff-badges">
                    <Badge tone={member.status === 'Active' ? 'success' : 'neutral'}>{member.status === 'Active' ?i18n.t('ui.pages.admin.staff_management_page.aktiv_816345') :i18n.t('ui.pages.admin.staff_management_page.deaktiv_477e77')}</Badge>
                    <Badge tone="info">{roleLabel(currentRoleId(member), member.role)}</Badge>
                  </div>
                  {canManageStaffMember(member) ? (
                    <div className="staff-role-actions">
                      {canChangeRoles && !isOwnerStaffMember(member) ? (
                        <>
                          <select
                            aria-label={`${member.name} üçün rol`}
                            disabled={updatingRoleUserId === member.id}
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
                                {roleLabel(role.id, role.name)}
                              </option>
                            ))}
                          </select>
                          <ActionIconButton
                            disabled={updatingRoleUserId === member.id || Number(selectedRoleId(member)) === currentRoleId(member)}
                            label={`${member.name} üçün rolu yenilə`}
                            onClick={() => void handleRoleChange(member)}
                            title={updatingRoleUserId === member.id ?i18n.t('ui.pages.admin.staff_management_page.rol_yenilenir_be6da6') :i18n.t('ui.pages.admin.staff_management_page.rolu_yenile_4a78a1')}
                          >
                            <RefreshCw size={18} />
                          </ActionIconButton>
                        </>
                      ) : null}
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
                          title={deactivatingStaffId === member.id ?i18n.t('ui.pages.admin.staff_management_page.deaktiv_edilir_3b3fc2') :i18n.t('ui.pages.admin.staff_management_page.deaktiv_et_925033')}
                          tone="danger"
                        >
                          <Ban size={18} />
                        </ActionIconButton>
                      ) : (
                        <ActionIconButton
                          disabled={deactivatingStaffId === member.id}
                          label={`${member.name} əməkdaşını aktiv et`}
                          onClick={() => void handleActivate(member)}
                          title={deactivatingStaffId === member.id ?i18n.t('ui.pages.admin.staff_management_page.aktiv_edilir_3db6b8') :i18n.t('ui.pages.admin.staff_management_page.aktiv_et_3570b7')}
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
              {!selectedRestaurant ? null : !isLoading && staff.length === 0 ? (
                <EmptyState title={i18n.t('ui.pages.admin.staff_management_page.personal_tapilmadi_7f36f8')} message={i18n.t('ui.pages.admin.staff_management_page.bu_restoran_ucun_hele_personal_yaradil_7bd86c')} />
              ) : null}
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
    details.push({ field: 'Phone', label: 'Telefon', message: 'Operator kodunu seçin və 7 rəqəmli nömrəni daxil edin.' })
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
