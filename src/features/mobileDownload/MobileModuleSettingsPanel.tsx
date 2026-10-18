import { i18n } from '../../shared/i18n/i18n'
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
          <h2 id="mobile-module-title">{i18n.t('ui.features.mobile_download.mobile_module_settings_panel.mobil_tetbiq_f9673a')}</h2>
          <p>{i18n.t('ui.features.mobile_download.mobile_module_settings_panel.bu_restoran_ucun_isci_girisini_ve_tele_e898ed')}</p>
        </div>
      </div>

      <label className="mobile-module-option">
        <span>
          <strong>{i18n.t('ui.features.mobile_download.mobile_module_settings_panel.isciler_ucun_mobil_giris_20ba01')}</strong>
          <small>{i18n.t('ui.features.mobile_download.mobile_module_settings_panel.aktiv_muqavilesi_olan_bu_restoranin_is_f0c803')}</small>
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
          <strong>{i18n.t('ui.features.mobile_download.mobile_module_settings_panel.mobil_bildirisler_62313e')}</strong>
          <small>{i18n.t('ui.features.mobile_download.mobile_module_settings_panel.isci_ve_musteriler_ucun_push_bildirisl_7f01be')}</small>
        </span>
        <input
          checked={mobilePushEnabled}
          disabled={isSaving || !showDownloadLink}
          onChange={(event) => setMobilePushEnabled(event.target.checked)}
          type="checkbox"
        />
      </label>

      <p className="mobile-module-release-note">{i18n.t('ui.features.mobile_download.mobile_module_settings_panel.apk_yalniz_tesdiqlenmis_fayl_serverde__88b821')}</p>
      {error ? <StatusMessage autoHideMs={false} tone="danger">{error}</StatusMessage> : null}
      {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}

      <div className="mobile-module-actions">
        <Button disabled={!isDirty || isSaving} onClick={() => void onSave({ mobilePushEnabled: mobilePushEnabled && showDownloadLink, showDownloadLink })} type="button">
          {isSaving ?i18n.t('ui.features.mobile_download.mobile_module_settings_panel.saxlanilir_da0933') :i18n.t('ui.features.mobile_download.mobile_module_settings_panel.deyisiklikleri_saxla_3f2b66')}
        </Button>
      </div>
    </section>
  )
}
