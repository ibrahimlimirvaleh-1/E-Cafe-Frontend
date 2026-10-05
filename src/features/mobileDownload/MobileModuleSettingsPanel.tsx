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
  const [mobilePushEnabled, setMobilePushEnabled] = useState(settings.mobilePushEnabled)
  const [showDownloadLink, setShowDownloadLink] = useState(settings.showDownloadLink)

  useEffect(() => {
    setMobilePushEnabled(settings.mobilePushEnabled)
    setShowDownloadLink(settings.showDownloadLink)
  }, [settings.mobilePushEnabled, settings.showDownloadLink])

  const isDirty = mobilePushEnabled !== settings.mobilePushEnabled || showDownloadLink !== settings.showDownloadLink

  return (
    <section className="mobile-module-settings" aria-labelledby="mobile-module-title">
      <div className="mobile-module-heading">
        <Smartphone size={20} aria-hidden="true" />
        <div>
          <h2 id="mobile-module-title">Mobil bildiriş modulu</h2>
          <p>Bu restoran üçün əlavə xidmətin əlçatanlığını idarə edin.</p>
        </div>
      </div>

      <label className="mobile-module-option">
        <span>
          <strong>Mobil push xidməti</strong>
          <small>Yalnız xidmət satıldıqdan sonra aktivləşdirin.</small>
        </span>
        <input
          checked={mobilePushEnabled}
          disabled={isSaving}
          onChange={(event) => setMobilePushEnabled(event.target.checked)}
          type="checkbox"
        />
      </label>

      <label className="mobile-module-option">
        <span>
          <strong>Android yükləmə linki</strong>
          <small>Yayım hazır olduqda yalnız bu restoranın aktiv işçilərinin panelində görünə bilər.</small>
        </span>
        <input
          checked={showDownloadLink}
          disabled={isSaving}
          onChange={(event) => setShowDownloadLink(event.target.checked)}
          type="checkbox"
        />
      </label>

      <p className="mobile-module-release-note">İşçi keçidi serverdə yayım hazır olana qədər görünməyəcək.</p>
      {error ? <StatusMessage autoHideMs={false} tone="danger">{error}</StatusMessage> : null}
      {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}

      <div className="mobile-module-actions">
        <Button disabled={!isDirty || isSaving} onClick={() => void onSave({ mobilePushEnabled, showDownloadLink })} type="button">
          {isSaving ? 'Saxlanılır...' : 'Dəyişiklikləri saxla'}
        </Button>
      </div>
    </section>
  )
}
