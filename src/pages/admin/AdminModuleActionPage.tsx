import { i18n } from '../../shared/i18n/i18n'
import { AlertTriangle } from 'lucide-react'
import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { useTranslation } from 'react-i18next'
import { Button } from '../../shared/ui/Button'
import { ButtonLink } from '../../shared/ui/Button'

type AdminModuleActionPageProps = {
  moduleKey: AdminModuleKey
  action: 'deactivate' | 'terminate'
}

export function AdminModuleActionPage({ action, moduleKey }: AdminModuleActionPageProps) {
  useTranslation()
  const module = getAdminModule(moduleKey)
  const label = module.dangerLabel ?? (action === 'terminate' ? 'Müqaviləni ləğv et' : 'Deaktiv et')

  return (
    <main className="center-page">
      <article className="danger-panel">
        <AlertTriangle size={52} />
        <h1>{label}</h1>
        <p>{i18n.t('ui.pages.admin.admin_module_action_page.bu_emeliyyat_qeydi_sistemden_tam_silmi_647abf')}</p>
        <div className="action-row">
          <ButtonLink variant="secondary" to={module.route}>{i18n.t('ui.pages.admin.admin_module_action_page.geri_b68a31')}</ButtonLink>
          <Button variant="danger" type="button">{i18n.t('ui.pages.admin.admin_module_action_page.tesdiqle_66c7d8')}</Button>
        </div>
      </article>
    </main>
  )
}
