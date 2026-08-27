import { LogOut, Save, ShieldCheck } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

function isSuperAdmin(roleId?: string, roleName = '') {
  const normalizedRoleName = roleName.toLowerCase()
  return roleId === RoleIds.PlatformAdmin || normalizedRoleName.includes('super')
}

function isRestaurantScopedRole(roleId: number) {
  return [2, 3, 4, 6].includes(roleId)
}

export function ProfilePage() {
  const { logoutAll, setSession, updateUser, user } = useAuth()
  const navigate = useNavigate()
  const { data: profile, error, isLoading } = useAsyncData(() => ecafeApi.profile.get(), null, [])
  const { data: roles } = useAsyncData(() => ecafeApi.lookups.roles(), [], [])
  const [form, setForm] = useState({ name: '', surname: '', email: '', phone: '' })
  const [roleId, setRoleId] = useState('')
  const [fileId, setFileId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [formErrorDetails, setFormErrorDetails] = useState<ApiErrorDetail[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLogoutAllConfirmOpen, setIsLogoutAllConfirmOpen] = useState(false)
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false)
  const canChangeRole = isSuperAdmin(user?.roleId, user?.roleName)

  useEffect(() => {
    if (!profile) {
      return
    }

    setForm({
      name: profile.name,
      surname: profile.surname,
      email: profile.email,
      phone: profile.phone,
    })
    setRoleId(String(profile.roleId || user?.roleId || ''))
  }, [profile, user?.roleId])

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setFormErrorDetails([])
    setStatusMessage('')
    setIsSaving(true)

    try {
      await ecafeApi.profile.update({ ...form, fileId })
      updateUser({
        name: form.name,
        surname: form.surname,
        email: form.email,
      })
      setStatusMessage('Profil məlumatları yeniləndi.')
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Profil yenilənmədi.')
      setFormError(feedback.message)
      setFormErrorDetails(feedback.details)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile || !roleId) {
      return
    }

    setFormError('')
    setFormErrorDetails([])
    setStatusMessage('')
    setIsSaving(true)

    try {
      const tokens = await ecafeApi.users.updateRole(profile.id, Number(roleId))
      if (tokens.accessToken) {
        setSession(tokens)
        setStatusMessage('Rol dəyişdirildi və token yeniləndi.')
      } else {
        setStatusMessage('Rol dəyişdirildi.')
      }
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Rol dəyişdirilmədi.')
      setFormError(feedback.message)
      setFormErrorDetails(feedback.details)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogoutAllSessions() {
    setFormError('')
    setFormErrorDetails([])
    setStatusMessage('')
    setIsLoggingOutAll(true)

    try {
      await logoutAll()
      navigate('/login', { replace: true })
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Bütün cihazlardan çıxış əməliyyatı icra olunmadı.')
      setFormError(feedback.message)
      setFormErrorDetails(feedback.details)
      setIsLogoutAllConfirmOpen(false)
    } finally {
      setIsLoggingOutAll(false)
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <PageHeader title="Profil" description="Profil məlumatları yüklənir." />
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="page">
        <PageHeader title="Profil" description="Profil məlumatları tapılmadı." />
        <section className="placeholder-panel">
          <p>{error || 'Profil məlumatları yüklənmədi.'}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <PageHeader eyebrow="Hesab" title="Profil" description="Şəxsi məlumatlarını yenilə və aktiv rolunu yoxla." />

      <div className="admin-grid">
        <form className="admin-panel" onSubmit={handleProfileSubmit}>
          <div className="section-title">
            <span>Profil məlumatları</span>
            <h2>{profile.name} {profile.surname}</h2>
          </div>

          <div className="form-grid two">
            <TextField label="Ad" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label="Soyad" required value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} />
          </div>
          <TextField label="Email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <TextField label="Telefon" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <FileUploadField label="Profil şəkli" accept="image/*" onUploaded={setFileId} />

          <Button disabled={isSaving} type="submit">
            <Save size={18} />
            {isSaving ? 'Saxlanılır...' : 'Profili yenilə'}
          </Button>
        </form>

        <section className="admin-panel">
          <div className="section-title">
            <span>Rol və status</span>
            <h2>İcazə məlumatları</h2>
          </div>
          <div className="detail-list compact">
            <div>
              <span>Status</span>
              <Badge tone={profile.isActive ? 'success' : 'danger'}>{profile.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
            </div>
            <div>
              <span>Cari rol</span>
              <strong>{profile.role || user?.roleName || `Rol #${profile.roleId}`}</strong>
            </div>
            {profile.restaurantId ? (
              <div>
                <span>Restoran</span>
                <strong>{profile.restaurantName || `#${profile.restaurantId}`}</strong>
              </div>
            ) : null}
          </div>

          {canChangeRole ? (
            <form className="stacked-form" onSubmit={handleRoleSubmit}>
              <SelectField label="Rolu dəyiş" required value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                <option value="">Rol seç</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id} disabled={!profile.restaurantId && isRestaurantScopedRole(role.id)}>
                    {role.name}
                  </option>
                ))}
              </SelectField>
              <Button disabled={isSaving || !roleId} type="submit" variant="secondary">
                <ShieldCheck size={18} />
                Rolu yenilə
              </Button>
            </form>
          ) : (
            <p className="muted-text">Rol dəyişiklikləri yalnız platforma administratoru tərəfindən edilir.</p>
          )}
        </section>
      </div>

      <section className="admin-panel profile-security-panel">
        <div className="section-title">
          <span>Təhlükəsizlik</span>
          <h2>Aktiv sessiyalar</h2>
        </div>
        <p className="muted-text">
          Hesabınız başqa cihazlarda açıq qalıbsa, bütün aktiv sessiyaları bir əməliyyatla ləğv edə bilərsiniz.
        </p>
        <Button disabled={isLoggingOutAll} onClick={() => setIsLogoutAllConfirmOpen(true)} type="button" variant="danger">
          <LogOut size={18} />
          {isLoggingOutAll ? 'Bağlanır...' : 'Bütün cihazlardan çıxış et'}
        </Button>
      </section>

      {statusMessage ? <StatusMessage>{statusMessage}</StatusMessage> : null}
      {formError ? <StatusMessage details={formErrorDetails} tone="danger">{formError}</StatusMessage> : null}
      <ConfirmDialog
        confirmDisabled={isLoggingOutAll}
        confirmLabel={isLoggingOutAll ? 'Bağlanır...' : 'Bütün cihazlardan çıxış et'}
        isOpen={isLogoutAllConfirmOpen}
        message="Bu əməliyyat hesabınızın bütün cihazlardakı aktiv sessiyalarını bağlayacaq. Yenidən istifadə etmək üçün təkrar daxil olmaq lazım olacaq."
        onCancel={() => {
          if (!isLoggingOutAll) {
            setIsLogoutAllConfirmOpen(false)
          }
        }}
        onConfirm={() => void handleLogoutAllSessions()}
        title="Bütün sessiyalar bağlansın?"
      />
    </main>
  )
}
