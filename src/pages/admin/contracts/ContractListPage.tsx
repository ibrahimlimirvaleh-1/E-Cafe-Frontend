import { FileText } from 'lucide-react'
import { contractRow } from '../../../shared/api/mappers'
import { ecafeApi } from '../../../shared/api/ecafeApi'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { ButtonLink } from '../../../shared/ui/Button'
import { DataTable } from '../../../shared/ui/DataTable'
import { PageHeader } from '../../../shared/ui/PageHeader'

export function ContractListPage() {
  const { data: records, isLoading } = useAsyncData(() => ecafeApi.contracts.records(), [])
  const rows = records.map((record) => contractRow(record.contract, record.restaurantName))

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Müqavilələr"
        title="Müqavilələr"
        action={<ButtonLink to="/admin/contracts/new">Yeni müqavilə</ButtonLink>}
      />

      {isLoading ? <p className="online-only">Məlumatlar yüklənir...</p> : null}
      {!isLoading && rows.length === 0 ? (
        <section className="placeholder-panel">
          <FileText size={28} />
          <h2>Müqavilə yoxdur</h2>
          <ButtonLink to="/admin/contracts/new">Müqavilə yarat</ButtonLink>
        </section>
      ) : (
        <DataTable baseRoute="/admin/contracts" columns={['Müqavilə', 'Status', 'Tarix aralığı', 'Komissiya']} rows={rows} />
      )}
    </main>
  )
}
