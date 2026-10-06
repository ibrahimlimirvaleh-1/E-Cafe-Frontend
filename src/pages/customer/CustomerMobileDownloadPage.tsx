import { Download, RefreshCw, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { mobileDownloadApi, type MobileRelease } from '../../features/mobileDownload/mobileDownloadApi'
import { isReadyMobileRelease, saveMobileRelease } from '../../features/mobileDownload/releaseUtils'
import { endpoints } from '../../shared/api/endpoints'
import { ApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { PageHeader } from '../../shared/ui/PageHeader'
import '../../features/mobileDownload/mobileDownload.css'

type ReleaseState = {
  key: string
  status: 'ready' | 'unavailable' | 'invalid' | 'denied' | 'login' | 'error'
  release: MobileRelease | null
}

const downloadPath = `/api/v1${endpoints.mobileApp.customerDownload}`

function failedState(key: string, error: unknown): ReleaseState {
  const status = error instanceof ApiError && error.statusCode === 403
    ? 'denied'
    : error instanceof ApiError && error.statusCode === 401
      ? 'login'
      : 'error'
  return { key, status, release: null }
}

export function CustomerMobileDownloadPage() {
  const { user } = useAuth()
  const profileKey = user?.roleId === RoleIds.Customer ? `${user.userId}:${user.roleId}:${user.restaurantId ?? ''}` : ''
  const currentProfile = useRef(profileKey)
  currentProfile.current = profileKey
  const generation = useRef(0)
  const [releaseState, setReleaseState] = useState<ReleaseState | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    if (!profileKey) return
    const requestGeneration = ++generation.current
    let active = true
    setDownloading(false)
    setDownloadError('')

    const refresh = async () => {
      try {
        const release = await mobileDownloadApi.customerRelease()
        if (!active || generation.current !== requestGeneration || currentProfile.current !== profileKey) return
        setReleaseState({
          key: profileKey,
          status: !release?.ready ? 'unavailable' : isReadyMobileRelease(release, downloadPath) ? 'ready' : 'invalid',
          release: isReadyMobileRelease(release, downloadPath) ? release : null,
        })
      } catch (error) {
        if (active && generation.current === requestGeneration && currentProfile.current === profileKey) setReleaseState(failedState(profileKey, error))
      }
    }

    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      generation.current += 1
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [profileKey, retryKey])

  if (!profileKey) return null

  const state = releaseState?.key === profileKey ? releaseState : null
  const retry = () => {
    setReleaseState(null)
    setDownloadError('')
    setRetryKey((current) => current + 1)
  }

  const download = async () => {
    if (downloading || state?.status !== 'ready') return
    const requestGeneration = generation.current
    const isCurrent = () => generation.current === requestGeneration && currentProfile.current === profileKey
    setDownloading(true)
    setDownloadError('')
    try {
      const latest = await mobileDownloadApi.customerRelease()
      if (!isCurrent()) return
      if (!latest?.ready) {
        setReleaseState({ key: profileKey, status: 'unavailable', release: null })
        return
      }
      if (!isReadyMobileRelease(latest, downloadPath)) {
        setReleaseState({ key: profileKey, status: 'invalid', release: null })
        return
      }
      const blob = await mobileDownloadApi.downloadCustomer()
      if (!isCurrent()) return
      saveMobileRelease(blob, latest)
      setReleaseState({ key: profileKey, status: 'ready', release: latest })
    } catch (error) {
      if (!isCurrent()) return
      if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
        setReleaseState(failedState(profileKey, error))
      } else if (error instanceof ApiError && error.statusCode === 404) {
        setReleaseState({ key: profileKey, status: 'unavailable', release: null })
      } else {
        setDownloadError('Yükləmə alınmadı. Bir az sonra yenidən yoxlayın.')
      }
    } finally {
      if (isCurrent()) setDownloading(false)
    }
  }

  return (
    <main className="page customer-mobile-page">
      <PageHeader eyebrow="Hesab" title="Android tətbiqi" />
      <section className="customer-mobile-panel" aria-label="ECafe Android tətbiqi">
        <div className="customer-mobile-heading">
          <span className="customer-mobile-icon"><Smartphone size={24} aria-hidden="true" /></span>
          <div>
            <h2>ECafe mobil tətbiqi</h2>
            <p>Android telefonunuz üçün APK faylını hesabınızla yükləyin.</p>
          </div>
        </div>

        {!state ? <p className="customer-mobile-status" role="status">Buraxılış yoxlanılır...</p> : null}
        {state?.status === 'ready' ? (
          <div className="customer-mobile-release">
            <span>Versiya <strong>{state.release?.version}</strong></span>
            <span>{((state.release?.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        ) : null}
        {state?.status === 'unavailable' ? <p className="customer-mobile-status" role="status">Android tətbiqinin yükləməsi hazırda mümkün deyil.</p> : null}
        {state?.status === 'invalid' ? <p className="customer-mobile-status customer-mobile-error" role="alert">Buraxılış məlumatı uyğun gəlmir. Bir az sonra yenidən yoxlayın.</p> : null}
        {state?.status === 'denied' ? <p className="customer-mobile-status customer-mobile-error" role="alert">Bu hesab üçün yükləmə icazəsi yoxdur. Müştəri hesabınızın aktiv olduğunu yoxlayın.</p> : null}
        {state?.status === 'login' ? <p className="customer-mobile-status" role="alert">Sessiyanız başa çatıb. Yenidən daxil olun.</p> : null}
        {state?.status === 'error' ? <p className="customer-mobile-status customer-mobile-error" role="alert">Buraxılış yoxlanılmadı. Bağlantınızı yoxlayıb yenidən cəhd edin.</p> : null}
        {downloadError ? <p className="customer-mobile-status customer-mobile-error" role="alert">{downloadError}</p> : null}

        <div className="customer-mobile-actions">
          {state?.status === 'ready' ? (
            <button className="mobile-download-link" disabled={downloading} onClick={() => void download()} type="button">
              <Download size={17} aria-hidden="true" />
              {downloading ? 'Yüklənir...' : 'APK-ni yüklə'}
            </button>
          ) : null}
          {state?.status === 'login' ? <Link className="mobile-download-link" to="/login">Daxil ol</Link> : null}
          {state && state.status !== 'login' ? (
            <button className="customer-mobile-refresh" disabled={downloading} onClick={retry} type="button" title="Yenidən yoxla">
              <RefreshCw size={17} aria-hidden="true" />
              <span>Yenidən yoxla</span>
            </button>
          ) : null}
        </div>
      </section>
    </main>
  )
}
