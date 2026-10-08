import { useEffect, useRef, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { endpoints } from '../../shared/api/endpoints'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds } from '../../shared/auth/authz'
import { mobileDownloadApi, type MobileRelease } from './mobileDownloadApi'
import { isReadyMobileRelease, saveMobileRelease } from './releaseUtils'
import './mobileDownload.css'

const staffRoles: readonly string[] = [RoleIds.Owner, RoleIds.Manager, RoleIds.Waiter, RoleIds.Kitchen]

export function EmployeeMobileDownload() {
  const { user } = useAuth()
  const restaurantId = user?.restaurantId ?? ''
  const roleId = user?.roleId ?? ''
  const profileKey = user?.userId && staffRoles.includes(roleId) && restaurantId ? `${user.userId}:${restaurantId}:${roleId}` : ''
  const currentProfile = useRef(profileKey)
  currentProfile.current = profileKey
  const generation = useRef(0)
  const [releaseState, setReleaseState] = useState<{ key: string; release: MobileRelease } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profileKey) return
    const requestGeneration = ++generation.current
    let active = true
    setDownloading(false)
    setError('')

    const refresh = async () => {
      try {
        const release = await mobileDownloadApi.staffRelease(restaurantId)
        if (active && generation.current === requestGeneration) setReleaseState(isReadyMobileRelease(release, `/api/v1${endpoints.mobileApp.staffDownload(restaurantId)}`) ? { key: profileKey, release } : null)
      } catch {
        if (active && generation.current === requestGeneration) setReleaseState(null)
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
      generation.current += 1
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
    const requestGeneration = generation.current
    const isCurrent = () => generation.current === requestGeneration && currentProfile.current === profileKey
    setDownloading(true)
    setError('')
    try {
      const latest = await mobileDownloadApi.staffRelease(restaurantId)
      if (!isCurrent()) return
      if (!isReadyMobileRelease(latest, `/api/v1${endpoints.mobileApp.staffDownload(restaurantId)}`)) {
        setReleaseState(null)
        return
      }
      const blob = await mobileDownloadApi.download(restaurantId)
      if (!isCurrent()) return
      saveMobileRelease(blob, latest)
    } catch {
      if (isCurrent()) {
        setReleaseState(null)
        setError('Yükləmə mümkün olmadı. Səhifəni yeniləyib təkrar yoxlayın.')
      }
    } finally {
      if (isCurrent()) setDownloading(false)
    }
  }

  return (
    <section className="employee-mobile-download" aria-label="Android tətbiqi">
      <div className="employee-mobile-download-inner">
        <div className="employee-mobile-download-copy">
          <Smartphone size={20} aria-hidden="true" />
          <span><strong>ECafe Android</strong><small>Versiya {release.version}</small></span>
        </div>
        {error ? <span className="employee-mobile-download-error" role="alert">{error}</span> : null}
        <button className="mobile-download-link" disabled={downloading} onClick={() => void download()} type="button">
          <Download size={17} aria-hidden="true" />
          {downloading ? 'Yüklənir...' : 'Tətbiqi yüklə'}
        </button>
      </div>
    </section>
  )
}
