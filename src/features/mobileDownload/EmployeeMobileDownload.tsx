import { useEffect, useRef, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { endpoints } from '../../shared/api/endpoints'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { mobileDownloadApi, type MobileRelease } from './mobileDownloadApi'
import './mobileDownload.css'

const staffRoles: readonly string[] = [RoleIds.Owner, RoleIds.Manager, RoleIds.Waiter, RoleIds.Kitchen]

function readyRelease(release: MobileRelease | null, restaurantId: string): release is MobileRelease {
  return release?.ready === true &&
    release.downloadPath === `/api/v1${endpoints.mobileApp.staffDownload(restaurantId)}` &&
    Boolean(release.version?.trim()) &&
    Number.isSafeInteger(release.versionCode) && (release.versionCode ?? 0) > 0 &&
    Number.isSafeInteger(release.sizeBytes) && (release.sizeBytes ?? 0) > 0 &&
    /^[a-f\d]{64}$/i.test(release.sha256 ?? '')
}

export function EmployeeMobileDownload() {
  const { user } = useAuth()
  const restaurantId = user?.restaurantId ?? ''
  const roleId = user?.roleId ?? ''
  const profileKey = staffRoles.includes(roleId) && restaurantId ? `${restaurantId}:${roleId}` : ''
  const currentProfile = useRef(profileKey)
  currentProfile.current = profileKey
  const [releaseState, setReleaseState] = useState<{ key: string; release: MobileRelease } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profileKey) return
    let active = true

    const refresh = async () => {
      try {
        const release = await mobileDownloadApi.staffRelease(restaurantId)
        if (active) setReleaseState(readyRelease(release, restaurantId) ? { key: profileKey, release } : null)
      } catch {
        if (active) setReleaseState(null)
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [profileKey, restaurantId])

  const release = releaseState?.key === profileKey ? releaseState.release : null
  if (!profileKey) return null
  if (!release) {
    return error ? <div className="employee-mobile-download employee-mobile-download-error" role="alert">{error}</div> : null
  }

  const download = async () => {
    if (downloading) return
    setDownloading(true)
    setError('')
    try {
      const latest = await mobileDownloadApi.staffRelease(restaurantId)
      if (currentProfile.current !== profileKey || !readyRelease(latest, restaurantId)) {
        setReleaseState(null)
        return
      }
      const blob = await mobileDownloadApi.download(restaurantId)
      if (currentProfile.current !== profileKey) return
      if (blob.size !== latest.sizeBytes) throw new Error('APK ölçüsü uyğun gəlmir.')

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ECafe-${latest.version!.replace(/[^a-zA-Z0-9.-]/g, '')}.apk`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      if (currentProfile.current === profileKey) {
        setReleaseState(null)
        setError('Yükləmə mümkün olmadı. Səhifəni yeniləyib təkrar yoxlayın.')
      }
    } finally {
      if (currentProfile.current === profileKey) setDownloading(false)
    }
  }

  return (
    <section className="employee-mobile-download" aria-label="Android tətbiqi">
      <div className="employee-mobile-download-copy">
        <Smartphone size={20} aria-hidden="true" />
        <span><strong>ECafe Android</strong><small>Versiya {release.version}</small></span>
      </div>
      {error ? <span className="employee-mobile-download-error" role="alert">{error}</span> : null}
      <button className="mobile-download-link" disabled={downloading} onClick={() => void download()} type="button">
        <Download size={17} aria-hidden="true" />
        {downloading ? 'Yüklənir...' : 'Tətbiqi yüklə'}
      </button>
    </section>
  )
}
