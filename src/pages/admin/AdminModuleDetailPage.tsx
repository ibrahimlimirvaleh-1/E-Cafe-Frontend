import { useParams } from 'react-router-dom'
import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

type AdminModuleDetailPageProps = {
  moduleKey: AdminModuleKey
}

export function AdminModuleDetailPage({ moduleKey }: AdminModuleDetailPageProps) {
  const params = useParams()
  const module = getAdminModule(moduleKey)
  const recordId = Object.values(params)[0] ?? ''
  const row = ecafeApi.admin.rows(moduleKey).find((entry) => entry.id === recordId) ?? ecafeApi.admin.rows(moduleKey)[0]

  return (
    <main className="admin-page narrow">
      <PageHeader eyebrow="Detallar" title={row.title} description={row.subtitle} />
      <section className="detail-panel">
        <Badge tone={row.tone}>{row.status}</Badge>
        <dl>
          <div>
            <dt>ID</dt>
            <dd>{row.id}</dd>
          </div>
          <div>
            <dt>{module.columns[2]}</dt>
            <dd>{row.meta}</dd>
          </div>
          <div>
            <dt>{module.columns[3]}</dt>
            <dd>{row.value}</dd>
          </div>
        </dl>
        <div className="action-row">
          <ButtonLink variant="secondary" to={module.route}>
            Siyahıya qayıt
          </ButtonLink>
          <ButtonLink to={`${module.route}/${row.id}/edit`}>Redaktə et</ButtonLink>
        </div>
      </section>
    </main>
  )
}
