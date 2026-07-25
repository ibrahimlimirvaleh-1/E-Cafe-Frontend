import { Save, ShieldCheck } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { SelectField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'

function isSuperAdmin(roleId?: string, roleName = '') {
  const normalizedRoleName = roleName.toLowerCase()
  return roleId === '1' || normalizedRoleName.includes('super')
}

function isRestaurantScopedRole(roleId: number) {
  return [2, 3, 4, 6].includes(roleId)
}

export function ProfilePage() {
  const { setSession, updateUser, user } = useAuth()
  const { data: profile, error, isLoading } = useAsyncData(() => ecafeApi.profile.get(), null, [])
  const { data: roles } = useAsyncData(() => ecafeApi.lookups.roles(), [], [])
  const [form, setForm] = useState({ name: '', surname: '', email: '', phone: '' })
  const [roleId, setRoleId] = useState('')
  const [fileId, setFileId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
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
      setFormError(err instanceof Error ? err.message : 'Profil yenilənmədi.')
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
      setFormError(err instanceof Error ? err.message : 'Rol dəyişdirilmədi.')
    } finally {
      setIsSaving(false)
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
          <FileUploadField label="Profil şəkli" onUploaded={setFileId} />

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

      {statusMessage ? <p className="form-success">{statusMessage}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}
    </main>
  )
}
