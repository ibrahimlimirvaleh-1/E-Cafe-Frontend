import { useEffect, useState } from 'react'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { Button } from '../../shared/ui/Button'
import { MobileModuleSettingsPanel } from './MobileModuleSettingsPanel'
import { mobileDownloadApi, type MobileModule, type MobileModuleUpdate } from './mobileDownloadApi'

export function RestaurantMobileModuleSection({ restaurantId }: { restaurantId: string }) {
  const [settings, setSettings] = useState<MobileModule | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    setSettings(null)
    setIsLoading(true)
    setError('')
    setSuccess('')

    mobileDownloadApi.restaurantModule(restaurantId)
      .then((result) => {
        if (active) setSettings(result)
      })
      .catch((err) => {
        if (active) setError(normalizeCaughtApiError(err, 'Mobil modul ayarları yüklənmədi.').message)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
  }, [restaurantId, retryKey])

  const save = async (next: MobileModuleUpdate) => {
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await mobileDownloadApi.updateRestaurantModule(restaurantId, next)
      setSettings(updated)
      setSuccess('Mobil modul ayarları saxlanıldı.')
    } catch (err) {
      setError(normalizeCaughtApiError(err, 'Mobil modul ayarları saxlanılmadı.').message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <p className="mobile-module-loading" role="status">Mobil modul ayarları yüklənir...</p>
  if (!settings) return (
    <div className="mobile-module-error" role="alert">
      <p>{error || 'Mobil modul ayarları əlçatan deyil.'}</p>
      <Button onClick={() => setRetryKey((value) => value + 1)} type="button" variant="secondary">Yenidən yoxla</Button>
    </div>
  )

  return <MobileModuleSettingsPanel error={error} isSaving={isSaving} onSave={save} settings={settings} success={success} />
}
