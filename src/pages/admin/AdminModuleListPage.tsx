import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
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
  const module = getAdminModule(moduleKey)
  const { data: rows, isLoading } = useAsyncData(
    () => moduleKey === 'payments' ? Promise.resolve([]) : ecafeApi.admin.rows(moduleKey),
    [],
    [moduleKey],
  )

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={module.title}
        action={
          module.createLabel ? (
            <ButtonLink to={`${module.route}/new`}>{module.createLabel}</ButtonLink>
          ) : null
        }
      />
      {moduleKey === 'payments' ? (
        <StatusMessage tone="info" autoHideMs={false}>Real ödəniş reyestri hələ aktiv deyil. Demo məlumatları maliyyə hesabatı kimi istifadə etməyin.</StatusMessage>
      ) : null}
      {isLoading ? <p className="online-only">Məlumatlar yüklənir...</p> : null}
      {moduleKey !== 'payments' ? <DataTable baseRoute={module.route} columns={module.columns} rows={rows} /> : null}
    </main>
  )
}
