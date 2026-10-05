import { Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mobileDownloadApi, type MobilePublication } from '../../features/mobileDownload/mobileDownloadApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import '../../features/mobileDownload/mobileDownload.css'

export function MobileAppPublicationPage() {
  const [publication, setPublication] = useState<MobilePublication | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    setPublication(null)
    setIsLoading(true)
    setError('')
    setSuccess('')
    mobileDownloadApi.publication()
      .then((result) => {
        if (!active) return
        setPublication(result)
        setEnabled(result.publicDownloadEnabled)
      })
      .catch((err) => {
        if (active) setError(normalizeCaughtApiError(err, 'Mobil tətbiq ayarları yüklənmədi.').message)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [retryKey])

  const save = async () => {
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await mobileDownloadApi.updatePublication(enabled)
      setPublication(updated)
      setEnabled(updated.publicDownloadEnabled)
      setSuccess('Android yükləmə linkinin ayarı saxlanıldı.')
    } catch (err) {
      setError(normalizeCaughtApiError(err, 'Yükləmə linki ayarı saxlanılmadı.').message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="admin-page narrow mobile-publication-page">
      <PageHeader eyebrow="Platform admin" title="Mobil tətbiq" />
      {isLoading ? <p className="mobile-module-loading" role="status">Mobil tətbiq ayarları yüklənir...</p> : null}
      {!isLoading && !publication ? (
        <div className="mobile-module-error" role="alert">
          <p>{error || 'Mobil tətbiq ayarları əlçatan deyil.'}</p>
          <Button onClick={() => setRetryKey((value) => value + 1)} type="button" variant="secondary">Yenidən yoxla</Button>
        </div>
      ) : null}
      {publication ? (
        <section className="mobile-module-settings" aria-labelledby="mobile-publication-title">
          <div className="mobile-module-heading">
            <Smartphone size={20} aria-hidden="true" />
            <div>
              <h2 id="mobile-publication-title">Saytdakı Android linki</h2>
              <p>Ana səhifədəki yükləmə linkini idarə edin.</p>
            </div>
          </div>
          <label className="mobile-module-option">
            <span>
              <strong>Yükləmə linkini göstər</strong>
              <small>Yalnız yoxlanmış və yayıma hazır APK üçün aktivləşdirilə bilər.</small>
            </span>
            <input
              checked={enabled}
              disabled={isSaving || (!publication.releaseReady && !enabled)}
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
          </label>
          <p className="mobile-module-release-note">
            {publication.releaseReady
              ? 'Android paketi saytda yayıma hazırdır.'
              : 'APK saytda yayıma hazır deyil. Serverə yoxlanmış APK yükləmə linki və yayım məlumatları əlavə edilməlidir.'}
          </p>
          {error ? <StatusMessage autoHideMs={false} tone="danger">{error}</StatusMessage> : null}
          {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}
          <div className="mobile-module-actions">
            <Button disabled={isSaving || enabled === publication.publicDownloadEnabled} onClick={() => void save()} type="button">
              {isSaving ? 'Saxlanılır...' : 'Dəyişiklikləri saxla'}
            </Button>
          </div>
        </section>
      ) : null}
      <Link className="mobile-publication-back" to="/admin/restaurants">Restoranlara qayıt</Link>
    </main>
  )
}
