import { i18n } from '../../shared/i18n/i18n'
import { LogOut, MonitorSmartphone, Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserSession } from '../../entities/types'
import { EmployeeMobileDownload } from '../../features/mobileDownload/EmployeeMobileDownload'
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
        <PageHeader title={i18n.t('ui.pages.customer.profile_page.profil_e267d3')} />
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="page">
        <PageHeader title={i18n.t('ui.pages.customer.profile_page.profil_e267d3')} />
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
      <PageHeader eyebrow={i18n.t('ui.pages.customer.profile_page.hesab_18adfa')} title={i18n.t('ui.pages.customer.profile_page.profil_e267d3')} />

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
            <Badge tone={profile.isActive ? 'success' : 'danger'}>{profile.isActive ?i18n.t('ui.pages.customer.profile_page.aktiv_816345') :i18n.t('ui.pages.customer.profile_page.deaktiv_477e77')}</Badge>
            <Badge tone="info">{activeProfile?.roleName || user?.roleName || profile.role || `Rol #${profile.roleId}`}</Badge>
          </div>
        </div>
      </section>

      <EmployeeMobileDownload />

      <div className="admin-grid profile-account-grid">
        <form className="admin-panel profile-account-form" onSubmit={handleProfileSubmit}>
          <div className="section-title">
            <span>{i18n.t('ui.pages.customer.profile_page.profil_melumatlari_24434a')}</span>
            <h2>{profile.name} {profile.surname}</h2>
          </div>

          <div className="form-grid two">
            <TextField label={i18n.t('ui.pages.customer.profile_page.ad_1d97c9')} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label={i18n.t('ui.pages.customer.profile_page.soyad_3d89d4')} required value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} />
          </div>
          <TextField label={i18n.t('ui.pages.customer.profile_page.email_969ccb')} required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <PhoneField label={i18n.t('ui.pages.customer.profile_page.telefon_fa6906')} value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <FileUploadField label={i18n.t('ui.pages.customer.profile_page.profil_sekli_dba45b')} accept="image/jpeg,image/png,image/webp,image/avif" onUploaded={setFileId} />

          <Button disabled={isSaving} type="submit">
            <Save size={18} />
            {isSaving ?i18n.t('ui.pages.customer.profile_page.saxlanilir_da0933') :i18n.t('ui.pages.customer.profile_page.profili_yenile_e2f9d6')}
          </Button>
        </form>

        <section className="admin-panel">
          <div className="section-title">
            <span>{i18n.t('ui.pages.customer.profile_page.rol_ve_icaze_c54ba6')}</span>
            <h2>{i18n.t('ui.pages.customer.profile_page.cari_giris_profili_dbfe16')}</h2>
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
                <Badge tone="success">{i18n.t('ui.pages.customer.profile_page.cari_profil_609da3')}</Badge>
              </article>
            ) : (
              <div className="empty-state compact">{i18n.t('ui.pages.customer.profile_page.bu_hesab_ucun_restoran_profili_yoxdur_a98da3')}</div>
            )}
          </div>
          <p className="muted-text">{i18n.t('ui.pages.customer.profile_page.profil_deyisimi_header_deki_hesab_meny_7cd42d')}</p>
        </section>

        <section className="admin-panel profile-security-panel">
          <div className="section-title">
            <span>{i18n.t('ui.pages.customer.profile_page.tehlukesizlik_696142')}</span>
            <h2>{i18n.t('ui.pages.customer.profile_page.aktiv_sessiyalar_b6f17c')}</h2>
          </div>
          <p className="muted-text">{i18n.t('ui.pages.customer.profile_page.hesabinizin_aciq_oldugu_cihazlari_yoxl_5652d5')}</p>

          <div className="session-list">
            {isSessionsLoading ? (
              <div className="empty-state compact">{i18n.t('ui.pages.customer.profile_page.aktiv_sessiyalar_yuklenir_ed3ba3')}</div>
            ) : sessionsError ? (
              <div className="empty-state compact">{sessionsError}</div>
            ) : sessions.length === 0 ? (
              <div className="empty-state compact">{i18n.t('ui.pages.customer.profile_page.aktiv_sessiya_tapilmadi_75c0a8')}</div>
            ) : (
              sessions.map((session) => (
                <article className="session-row" key={session.sessionId}>
                  <span className="session-row-icon">
                    <MonitorSmartphone size={20} />
                  </span>
                  <div>
                    <strong>{session.device}</strong>
                    <span>
                      {session.ipAddress || 'IP qeyd olunmayıb'} {i18n.t('ui.pages.customer.profile_page.son_aktivlik_ef6737')} {formatSessionDate(session.lastSeenAt)}
                    </span>
                  </div>
                  {session.isCurrent ? <Badge tone="success">{i18n.t('ui.pages.customer.profile_page.cari_sessiya_9f35d4')}</Badge> : null}
                  <Button
                    disabled={revokingSessionId === session.sessionId}
                    onClick={() => void handleRevokeSession(session)}
                    type="button"
                    variant={session.isCurrent ? 'danger' : 'secondary'}
                  >
                    <LogOut size={18} />
                    {revokingSessionId === session.sessionId ?i18n.t('ui.pages.customer.profile_page.baglanir_6fd246') :i18n.t('ui.pages.customer.profile_page.bagla_c1cf91')}
                  </Button>
                </article>
              ))
            )}
          </div>

          <Button disabled={isLoggingOutAll} onClick={() => setIsLogoutAllConfirmOpen(true)} type="button" variant="danger">
            <LogOut size={18} />
            {isLoggingOutAll ?i18n.t('ui.pages.customer.profile_page.baglanir_6fd246') :i18n.t('ui.pages.customer.profile_page.butun_cihazlardan_cixis_et_32d8ca')}
          </Button>
        </section>
      </div>

      {statusMessage ? <StatusMessage>{statusMessage}</StatusMessage> : null}
      {formError ? <StatusMessage details={formErrorDetails} tone="danger">{formError}</StatusMessage> : null}
      <ConfirmDialog
        confirmDisabled={isLoggingOutAll}
        confirmLabel={isLoggingOutAll ?i18n.t('ui.pages.customer.profile_page.baglanir_6fd246') :i18n.t('ui.pages.customer.profile_page.butun_cihazlardan_cixis_et_32d8ca')}
        isOpen={isLogoutAllConfirmOpen}
        message={i18n.t('ui.pages.customer.profile_page.bu_emeliyyat_hesabinizin_butun_cihazla_567745')}
        onCancel={() => {
          if (!isLoggingOutAll) {
            setIsLogoutAllConfirmOpen(false)
          }
        }}
        onConfirm={() => void handleLogoutAllSessions()}
        title={i18n.t('ui.pages.customer.profile_page.butun_sessiyalar_baglansin_b6424f')}
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
