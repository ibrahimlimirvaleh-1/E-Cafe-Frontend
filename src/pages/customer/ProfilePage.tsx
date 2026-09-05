import { LogOut, MonitorSmartphone, Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserSession } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { FileUploadField } from '../../shared/ui/FileUploadField'
import { TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { PhoneField } from '../../shared/ui/PhoneField'
import { StatusMessage } from '../../shared/ui/StatusMessage'

export function ProfilePage() {
  const { logout, logoutAll, updateUser, user } = useAuth()
  const navigate = useNavigate()
  const { data: profile, error, isLoading } = useAsyncData(() => ecafeApi.profile.get(), null, [])
  const [form, setForm] = useState({ name: '', surname: '', email: '', phone: '' })
  const [fileId, setFileId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [sessionsError, setSessionsError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [formErrorDetails, setFormErrorDetails] = useState<ApiErrorDetail[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isSessionsLoading, setIsSessionsLoading] = useState(true)
  const [isLogoutAllConfirmOpen, setIsLogoutAllConfirmOpen] = useState(false)
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false)
  const [revokingSessionId, setRevokingSessionId] = useState('')

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
  }, [profile])

  useEffect(() => {
    let isMounted = true

    async function loadSessions() {
      setIsSessionsLoading(true)
      setSessionsError('')

      try {
        const result = await ecafeApi.userSessions.list()
        if (isMounted) {
          setSessions(result)
        }
      } catch (err) {
        if (isMounted) {
          setSessionsError(normalizeCaughtApiError(err, 'Aktiv sessiyalar yüklənmədi.').message)
        }
      } finally {
        if (isMounted) {
          setIsSessionsLoading(false)
        }
      }
    }

    void loadSessions()

    return () => {
      isMounted = false
    }
  }, [])

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

  async function handleRevokeSession(session: UserSession) {
    setFormError('')
    setFormErrorDetails([])
    setStatusMessage('')
    setRevokingSessionId(session.sessionId)

    try {
      if (session.isCurrent) {
        await logout()
        navigate('/login', { replace: true })
        return
      }

      await ecafeApi.userSessions.revoke(session.sessionId)
      setSessions((currentSessions) => currentSessions.filter((item) => item.sessionId !== session.sessionId))
      setStatusMessage('Seçilmiş sessiya bağlandı.')
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Sessiya bağlanmadı.')
      setFormError(feedback.message)
      setFormErrorDetails(feedback.details)
    } finally {
      setRevokingSessionId('')
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

  const accessProfiles = profile.profiles.length > 0
    ? profile.profiles
    : user?.profiles.map((item) => ({
        restaurantId: item.restaurantId,
        restaurantName: item.restaurantName || `Restoran #${item.restaurantId}`,
        roleId: Number(item.roleId),
        roleName: item.roleName || `Rol #${item.roleId}`,
        isActive: item.isActive !== false,
      })) ?? []
  const activeProfile = accessProfiles.find((item) => String(item.restaurantId) === user?.restaurantId && String(item.roleId) === user?.roleId)

  return (
    <main className="page">
      <PageHeader eyebrow="Hesab" title="Profil" description="Şəxsi məlumatlarını yenilə, rolunu və hesab təhlükəsizliyini idarə et." />

      <section className="profile-summary-card">
        <div className="profile-summary-avatar" aria-hidden="true">
          {profile.fileUrl ? (
            <img src={profile.fileUrl} alt="" />
          ) : (
            getInitials(profile.name, profile.surname)
          )}
        </div>
        <div className="profile-summary-content">
          <h2>{profile.name} {profile.surname}</h2>
          <p>{profile.email} · {profile.phone || 'Telefon qeyd olunmayıb'}</p>
          <div className="profile-summary-badges">
            <Badge tone={profile.isActive ? 'success' : 'danger'}>{profile.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
            <Badge tone="info">{activeProfile?.roleName || user?.roleName || profile.role || `Rol #${profile.roleId}`}</Badge>
          </div>
        </div>
      </section>

      <div className="admin-grid profile-account-grid">
        <form className="admin-panel profile-account-form" onSubmit={handleProfileSubmit}>
          <div className="section-title">
            <span>Profil məlumatları</span>
            <h2>{profile.name} {profile.surname}</h2>
          </div>

          <div className="form-grid two">
            <TextField label="Ad" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label="Soyad" required value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} />
          </div>
          <TextField label="Email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <PhoneField label="Telefon" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <FileUploadField label="Profil şəkli" accept="image/jpeg,image/png,image/webp,image/avif" onUploaded={setFileId} />

          <Button disabled={isSaving} type="submit">
            <Save size={18} />
            {isSaving ? 'Saxlanılır...' : 'Profili yenilə'}
          </Button>
        </form>

        <section className="admin-panel">
          <div className="section-title">
            <span>Rol və icazə</span>
            <h2>Cari giriş profili</h2>
          </div>
          <div className="access-profile-list">
            {activeProfile ? (
              <article className="access-profile-card active">
                <span className="access-profile-icon" aria-hidden="true">
                  {(activeProfile.restaurantName || 'R').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{activeProfile.restaurantName || `Restoran #${activeProfile.restaurantId}`}</strong>
                  <small>{activeProfile.roleName || `Rol #${activeProfile.roleId}`}</small>
                </div>
                <Badge tone="success">Cari profil</Badge>
              </article>
            ) : (
              <div className="empty-state compact">Bu hesab üçün restoran profili yoxdur.</div>
            )}
          </div>
          <p className="muted-text">Profil dəyişimi header-dəki hesab menyusundan aparılır. Seçilən profilə görə menyular, icazələr və restoran məlumatları dəyişir.</p>
        </section>

        <section className="admin-panel profile-security-panel">
          <div className="section-title">
            <span>Təhlükəsizlik</span>
            <h2>Aktiv sessiyalar</h2>
          </div>
          <p className="muted-text">
            Hesabınızın açıq olduğu cihazları yoxlayın və tanımadığınız sessiyaları bağlayın.
          </p>

          <div className="session-list">
            {isSessionsLoading ? (
              <div className="empty-state compact">Aktiv sessiyalar yüklənir.</div>
            ) : sessionsError ? (
              <div className="empty-state compact">{sessionsError}</div>
            ) : sessions.length === 0 ? (
              <div className="empty-state compact">Aktiv sessiya tapılmadı.</div>
            ) : (
              sessions.map((session) => (
                <article className="session-row" key={session.sessionId}>
                  <span className="session-row-icon">
                    <MonitorSmartphone size={20} />
                  </span>
                  <div>
                    <strong>{session.device}</strong>
                    <span>
                      {session.ipAddress || 'IP qeyd olunmayıb'} · Son aktivlik: {formatSessionDate(session.lastSeenAt)}
                    </span>
                  </div>
                  {session.isCurrent ? <Badge tone="success">Cari sessiya</Badge> : null}
                  <Button
                    disabled={revokingSessionId === session.sessionId}
                    onClick={() => void handleRevokeSession(session)}
                    type="button"
                    variant={session.isCurrent ? 'danger' : 'secondary'}
                  >
                    <LogOut size={18} />
                    {revokingSessionId === session.sessionId ? 'Bağlanır...' : 'Bağla'}
                  </Button>
                </article>
              ))
            )}
          </div>

          <Button disabled={isLoggingOutAll} onClick={() => setIsLogoutAllConfirmOpen(true)} type="button" variant="danger">
            <LogOut size={18} />
            {isLoggingOutAll ? 'Bağlanır...' : 'Bütün cihazlardan çıxış et'}
          </Button>
        </section>
      </div>

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

function getInitials(name: string, surname: string) {
  const initials = `${name?.trim().charAt(0) || ''}${surname?.trim().charAt(0) || ''}`.toUpperCase()
  return initials || 'U'
}

function formatSessionDate(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('az-Latn-AZ', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
