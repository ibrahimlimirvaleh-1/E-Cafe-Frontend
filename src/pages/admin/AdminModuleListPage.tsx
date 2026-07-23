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

const backendPendingModules: AdminModuleKey[] = ['reservations', 'orders', 'payments']

export function AdminModuleListPage({ moduleKey }: AdminModuleListPageProps) {
  const module = getAdminModule(moduleKey)
  const { data: rows, isLoading } = useAsyncData(() => ecafeApi.admin.rows(moduleKey), [], [moduleKey])
  const isBackendPending = backendPendingModules.includes(moduleKey)

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={module.title}
        description={isBackendPending ? `${module.description} Bu flow üçün backend endpoint-ləri hələ yazılmayıb.` : module.description}
        action={
          module.createLabel ? (
            <ButtonLink to={`${module.route}/new`}>{module.createLabel}</ButtonLink>
          ) : null
        }
      />
      {isLoading ? <p className="online-only">Məlumatlar yüklənir...</p> : null}
      {isBackendPending ? <p className="online-only">Bu bölmə hazırda demo/məlumatlandırıcı rejimdədir. Backend flow növbəti mərhələdə yazılacaq.</p> : null}
      <DataTable baseRoute={module.route} columns={module.columns} rows={rows} />
    </main>
  )
}
