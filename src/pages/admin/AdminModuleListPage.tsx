import { i18n } from '../../shared/i18n/i18n'
import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { useTranslation } from 'react-i18next'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ButtonLink } from '../../shared/ui/Button'
import { DataTable } from '../../shared/ui/DataTable'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type AdminModuleListPageProps = {
  moduleKey: AdminModuleKey
}

export function AdminModuleListPage({ moduleKey }: AdminModuleListPageProps) {
  useTranslation()
  const module = getAdminModule(moduleKey)
  const { data: rows, isLoading } = useAsyncData(
    () => moduleKey === 'payments' ? Promise.resolve([]) : ecafeApi.admin.rows(moduleKey),
    [],
    [moduleKey],
  )

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.admin_module_list_page.admin_c1c224')}
        title={module.title}
        action={
          module.createLabel ? (
            <ButtonLink to={`${module.route}/new`}>{module.createLabel}</ButtonLink>
          ) : null
        }
      />
      {moduleKey === 'payments' ? (
        <StatusMessage tone="info" autoHideMs={false}>{i18n.t('ui.pages.admin.admin_module_list_page.real_odenis_reyestri_hele_aktiv_deyil__9ee14c')}</StatusMessage>
      ) : null}
      {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.admin_module_list_page.melumatlar_yuklenir_53bd5f')}</p> : null}
      {moduleKey !== 'payments' ? <DataTable baseRoute={module.route} columns={module.columns} rows={rows} /> : null}
    </main>
  )
}
