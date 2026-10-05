import { Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './mobileDownload.css'

export type MobileModuleSettings = {
  mobilePushEnabled: boolean
  showDownloadLink: boolean
}

type MobileModuleSettingsPanelProps = {
  error: string
  isSaving: boolean
  onSave: (settings: Pick<MobileModuleSettings, 'mobilePushEnabled' | 'showDownloadLink'>) => Promise<void>
  settings: MobileModuleSettings
  success: string
}

export function MobileModuleSettingsPanel({ error, isSaving, onSave, settings, success }: MobileModuleSettingsPanelProps) {
  const [mobilePushEnabled, setMobilePushEnabled] = useState(settings.mobilePushEnabled && settings.showDownloadLink)
  const [showDownloadLink, setShowDownloadLink] = useState(settings.showDownloadLink)

  useEffect(() => {
    setMobilePushEnabled(settings.mobilePushEnabled && settings.showDownloadLink)
    setShowDownloadLink(settings.showDownloadLink)
  }, [settings.mobilePushEnabled, settings.showDownloadLink])

  const isDirty = mobilePushEnabled !== settings.mobilePushEnabled || showDownloadLink !== settings.showDownloadLink

  return (
    <section className="mobile-module-settings" aria-labelledby="mobile-module-title">
      <div className="mobile-module-heading">
        <Smartphone size={20} aria-hidden="true" />
        <div>
          <h2 id="mobile-module-title">Mobil tətbiq</h2>
          <p>Bu restoran üçün işçi girişini və telefon bildirişlərini idarə edin.</p>
        </div>
      </div>

      <label className="mobile-module-option">
        <span>
          <strong>İşçilər üçün mobil giriş</strong>
          <small>Aktiv müqaviləsi olan bu restoranın işçilərinə tətbiqə giriş və APK yükləmə icazəsi verir.</small>
        </span>
        <input
          checked={showDownloadLink}
          disabled={isSaving}
          onChange={(event) => {
            setShowDownloadLink(event.target.checked)
            if (!event.target.checked) setMobilePushEnabled(false)
          }}
          type="checkbox"
        />
      </label>

      <label className="mobile-module-option">
        <span>
          <strong>Mobil bildirişlər</strong>
          <small>İşçi və müştərilər üçün push bildirişləri. Mobil giriş tələb olunur.</small>
        </span>
        <input
          checked={mobilePushEnabled}
          disabled={isSaving || !showDownloadLink}
          onChange={(event) => setMobilePushEnabled(event.target.checked)}
          type="checkbox"
        />
      </label>

      <p className="mobile-module-release-note">APK yalnız təsdiqlənmiş fayl serverdə hazır olduqda işçi panelində görünür.</p>
      {error ? <StatusMessage autoHideMs={false} tone="danger">{error}</StatusMessage> : null}
      {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}

      <div className="mobile-module-actions">
        <Button disabled={!isDirty || isSaving} onClick={() => void onSave({ mobilePushEnabled: mobilePushEnabled && showDownloadLink, showDownloadLink })} type="button">
          {isSaving ? 'Saxlanılır...' : 'Dəyişiklikləri saxla'}
        </Button>
      </div>
    </section>
  )
}
