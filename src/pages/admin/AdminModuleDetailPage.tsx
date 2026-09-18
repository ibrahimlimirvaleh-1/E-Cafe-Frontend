import { useParams } from 'react-router-dom'
import type { AdminModuleKey, AdminRow } from '../../entities/types'
import { ReservationPaymentInstructionPanel } from '../../features/reservations/ReservationPaymentInstructionPanel'
import { getAdminModule } from '../../entities/mockData'
import { useAuth } from '../../shared/auth/AuthContext'
import { getRestaurantRoleId, hasPermission, hasPermissionForRole } from '../../shared/auth/authz'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

type AdminModuleDetailPageProps = {
  moduleKey: AdminModuleKey
}

export function AdminModuleDetailPage({ moduleKey }: AdminModuleDetailPageProps) {
  const { user } = useAuth()
  const params = useParams()
  const module = getAdminModule(moduleKey)
  const recordId = Object.values(params)[0] ?? ''
  const { data: row } = useAsyncData<AdminRow | null>(
    async () => {
      const rows = await ecafeApi.admin.rows(moduleKey)
      return rows.find((entry) => entry.id === recordId) ?? rows[0] ?? null
    },
    null,
    [moduleKey, recordId],
  )

  if (!row) {
    return (
      <main className="admin-page narrow">
        <p className="online-only">Detallar yüklənir...</p>
      </main>
    )
  }

  const canSendPaymentInstruction = row.restaurantId
    ? hasPermissionForRole(getRestaurantRoleId(user, row.restaurantId), 'ManageReservations')
    : hasPermission(user, 'ManageReservations')

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
      {moduleKey === 'reservations' && canSendPaymentInstruction ? (
        <ReservationPaymentInstructionPanel
          restaurantId={row.restaurantId || ''}
          reservationId={row.id}
          amount={row.value}
        />
      ) : null}
    </main>
  )
}
