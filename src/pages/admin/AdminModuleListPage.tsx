import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ButtonLink } from '../../shared/ui/Button'
import { DataTable } from '../../shared/ui/DataTable'
import { PageHeader } from '../../shared/ui/PageHeader'

type AdminModuleListPageProps = {
  moduleKey: AdminModuleKey
}

export function AdminModuleListPage({ moduleKey }: AdminModuleListPageProps) {
  const module = getAdminModule(moduleKey)
  const { data: rows, isLoading } = useAsyncData(() => ecafeApi.admin.rows(moduleKey), [], [moduleKey])

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
      {isLoading ? <p className="online-only">Məlumatlar yüklənir...</p> : null}
      <DataTable baseRoute={module.route} columns={module.columns} rows={rows} />
    </main>
  )
}
