import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { ButtonLink } from '../../shared/ui/Button'
import { DataTable } from '../../shared/ui/DataTable'
import { PageHeader } from '../../shared/ui/PageHeader'

type AdminModuleListPageProps = {
  moduleKey: AdminModuleKey
}

export function AdminModuleListPage({ moduleKey }: AdminModuleListPageProps) {
  const module = getAdminModule(moduleKey)
  const rows = ecafeApi.admin.rows(moduleKey)

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={module.title}
        description={module.description}
        action={
          module.createLabel ? (
            <ButtonLink to={`${module.route}/new`}>{module.createLabel}</ButtonLink>
          ) : null
        }
      />
      <DataTable baseRoute={module.route} columns={module.columns} rows={rows} />
    </main>
  )
}
