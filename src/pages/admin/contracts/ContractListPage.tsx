import { FileText } from 'lucide-react'
import { contractRow } from '../../../shared/api/mappers'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { useAuth } from '../../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../../shared/auth/authz'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { ButtonLink } from '../../../shared/ui/Button'
import { DataTable } from '../../../shared/ui/DataTable'
import { PageHeader } from '../../../shared/ui/PageHeader'

export function ContractListPage() {
  const { user } = useAuth()
  const { data: records, isLoading } = useAsyncData(() => ecafeApi.contracts.records(), [])
  const canManageContracts = isInRole(user, [RoleIds.PlatformAdmin])
  const rows = records.map((record) => {
    const row = contractRow(record.contract, record.restaurantName)
    return canManageContracts ? row : { ...row, canEdit: false }
  })

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Müqavilələr"
        title="Müqavilələr"
        action={canManageContracts ? <ButtonLink to="/admin/contracts/new">Yeni müqavilə</ButtonLink> : undefined}
      />

      {isLoading ? <p className="online-only">Məlumatlar yüklənir...</p> : null}
      {!isLoading && rows.length === 0 ? (
        <section className="placeholder-panel">
          <FileText size={28} />
          <h2>Müqavilə yoxdur</h2>
          {canManageContracts ? <ButtonLink to="/admin/contracts/new">Müqavilə yarat</ButtonLink> : null}
        </section>
      ) : (
        <DataTable baseRoute="/admin/contracts" columns={['Müqavilə', 'Status', 'Tarix aralığı', 'Komissiya']} rows={rows} />
      )}
    </main>
  )
}
