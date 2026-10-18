import { i18n } from '../../shared/i18n/i18n'
import { useParams } from 'react-router-dom'
import type { AdminModuleKey, AdminRow } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { useTranslation } from 'react-i18next'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type AdminModuleDetailPageProps = {
  moduleKey: AdminModuleKey
}

export function AdminModuleDetailPage({ moduleKey }: AdminModuleDetailPageProps) {
  useTranslation()
  const params = useParams()
  const module = getAdminModule(moduleKey)
  const recordId = Object.values(params)[0] ?? ''
  const { data: row } = useAsyncData<AdminRow | null>(
    async () => {
      if (moduleKey === 'payments') return null
      const rows = await ecafeApi.admin.rows(moduleKey)
      return rows.find((entry) => entry.id === recordId) ?? rows[0] ?? null
    },
    null,
    [moduleKey, recordId],
  )

  if (moduleKey === 'payments') {
    return <main className="admin-page narrow"><PageHeader eyebrow={i18n.t('ui.pages.admin.admin_module_detail_page.odenisler_2faefb')} title={i18n.t('ui.pages.admin.admin_module_detail_page.odenis_reyestri_ac251c')} /><StatusMessage tone="info" autoHideMs={false}>{i18n.t('ui.pages.admin.admin_module_detail_page.real_odenis_detallari_provayder_inteqr_d330f8')}</StatusMessage></main>
  }

  if (!row) {
    return (
      <main className="admin-page narrow">
        <p className="online-only">{i18n.t('ui.pages.admin.admin_module_detail_page.detallar_yuklenir_540320')}</p>
      </main>
    )
  }

  return (
    <main className="admin-page narrow">
      <PageHeader eyebrow={i18n.t('ui.pages.admin.admin_module_detail_page.detallar_4907d4')} title={row.title} description={row.subtitle} />
      <section className="detail-panel">
        <Badge tone={row.tone}>{row.status}</Badge>
        <dl>
          <div>
            <dt>{i18n.t('ui.pages.admin.admin_module_detail_page.id_384397')}</dt>
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
          <ButtonLink variant="secondary" to={module.route}>{i18n.t('ui.pages.admin.admin_module_detail_page.siyahiya_qayit_f779ce')}</ButtonLink>
          <ButtonLink to={`${module.route}/${row.id}/edit`}>{i18n.t('ui.pages.admin.admin_module_detail_page.redakte_et_5b03ba')}</ButtonLink>
        </div>
      </section>
    </main>
  )
}
