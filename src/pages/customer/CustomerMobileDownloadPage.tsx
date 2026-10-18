import { i18n } from '../../shared/i18n/i18n'
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
      <PageHeader eyebrow={i18n.t('ui.pages.customer.customer_mobile_download_page.hesab_18adfa')} title={i18n.t('ui.pages.customer.customer_mobile_download_page.android_tetbiqi_7a72cf')} />
      <section className="customer-mobile-panel" aria-label={i18n.t('ui.pages.customer.customer_mobile_download_page.ecafe_android_tetbiqi_3bfba7')}>
        <div className="customer-mobile-heading">
          <span className="customer-mobile-icon"><Smartphone size={24} aria-hidden="true" /></span>
          <div>
            <h2>{i18n.t('ui.pages.customer.customer_mobile_download_page.ecafe_mobil_tetbiqi_08e028')}</h2>
            <p>{i18n.t('ui.pages.customer.customer_mobile_download_page.android_telefonunuz_ucun_apk_faylini_h_b30758')}</p>
          </div>
        </div>

        {!state ? <p className="customer-mobile-status" role="status">{i18n.t('ui.pages.customer.customer_mobile_download_page.buraxilis_yoxlanilir_5cddb4')}</p> : null}
        {state?.status === 'ready' ? (
          <div className="customer-mobile-release">
            <span>{i18n.t('ui.pages.customer.customer_mobile_download_page.versiya_81b03c')} <strong>{state.release?.version}</strong></span>
            <span>{((state.release?.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB</span>
          </div>
        ) : null}
        {state?.status === 'unavailable' ? <p className="customer-mobile-status" role="status">{i18n.t('ui.pages.customer.customer_mobile_download_page.android_tetbiqinin_yuklemesi_hazirda_m_c68737')}</p> : null}
        {state?.status === 'invalid' ? <p className="customer-mobile-status customer-mobile-error" role="alert">{i18n.t('ui.pages.customer.customer_mobile_download_page.buraxilis_melumati_uygun_gelmir_bir_az_110dd9')}</p> : null}
        {state?.status === 'denied' ? <p className="customer-mobile-status customer-mobile-error" role="alert">{i18n.t('ui.pages.customer.customer_mobile_download_page.bu_hesab_ucun_yukleme_icazesi_yoxdur_m_e60899')}</p> : null}
        {state?.status === 'login' ? <p className="customer-mobile-status" role="alert">{i18n.t('ui.pages.customer.customer_mobile_download_page.sessiyaniz_basa_catib_yeniden_daxil_ol_f2739e')}</p> : null}
        {state?.status === 'error' ? <p className="customer-mobile-status customer-mobile-error" role="alert">{i18n.t('ui.pages.customer.customer_mobile_download_page.buraxilis_yoxlanilmadi_baglantinizi_yo_e01ac6')}</p> : null}
        {downloadError ? <p className="customer-mobile-status customer-mobile-error" role="alert">{downloadError}</p> : null}

        <div className="customer-mobile-actions">
          {state?.status === 'ready' ? (
            <button className="mobile-download-link" disabled={downloading} onClick={() => void download()} type="button">
              <Download size={17} aria-hidden="true" />
              {downloading ?i18n.t('ui.pages.customer.customer_mobile_download_page.yuklenir_e038b0') :i18n.t('ui.pages.customer.customer_mobile_download_page.apk_ni_yukle_6c5bf4')}
            </button>
          ) : null}
          {state?.status === 'login' ? <Link className="mobile-download-link" to="/login">{i18n.t('ui.pages.customer.customer_mobile_download_page.daxil_ol_2e157a')}</Link> : null}
          {state && state.status !== 'login' ? (
            <button className="customer-mobile-refresh" disabled={downloading} onClick={retry} type="button" title={i18n.t('ui.pages.customer.customer_mobile_download_page.yeniden_yoxla_9c69a3')}>
              <RefreshCw size={17} aria-hidden="true" />
              <span>{i18n.t('ui.pages.customer.customer_mobile_download_page.yeniden_yoxla_9c69a3')}</span>
            </button>
          ) : null}
        </div>
      </section>
    </main>
  )
}
