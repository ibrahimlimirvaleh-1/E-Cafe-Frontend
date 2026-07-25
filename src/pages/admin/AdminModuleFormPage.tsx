import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'

type AdminModuleFormPageProps = {
  moduleKey: AdminModuleKey
  mode: 'create' | 'edit'
}

const statusOptions: Partial<Record<AdminModuleKey, string[]>> = {
  reservations: ['Depozit gözləyir', 'Rezerv edilib', 'Oturub', 'Tamamlanıb', 'Ləğv edilib', 'Gəlmədi'],
  orders: ['Yaradılıb', 'Qəbul edilib', 'Hazırlanır', 'Hazırdır', 'Servis edilib', 'Bağlanıb', 'Ləğv edilib'],
  payments: ['Gözləyir', 'Ödənilib', 'Uğursuz', 'Geri qaytarılıb'],
  restaurants: ['Aktiv', 'Deaktiv'],
  staff: ['Aktiv', 'Deaktiv'],
  tables: ['Boşdur', 'Rezerv edilib', 'Məşğuldur', 'Gizlidir'],
  categories: ['Aktiv', 'Deaktiv'],
  menu: ['Satışdadır', 'Müvəqqəti yoxdur', 'Deaktiv'],
}

export function AdminModuleFormPage({ mode, moduleKey }: AdminModuleFormPageProps) {
  const module = getAdminModule(moduleKey)
  const isEdit = mode === 'edit'
  const statuses = statusOptions[moduleKey] ?? ['Aktiv', 'Deaktiv']

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={isEdit ? 'Redaktə' : 'Yeni qeyd'}
        title={isEdit ? `${module.singular} redaktə et` : module.createLabel ?? `${module.singular} yarat`}
      />
      <form className="form-layout">
        <section className="form-card">
          <TextField label={`${module.singular} adı`} placeholder={module.singular} defaultValue={isEdit ? `Demo ${module.singular}` : ''} />
          <div className="form-row">
            <SelectField label="Status" defaultValue={statuses[0]}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </SelectField>
            <TextField label={module.columns[2]} placeholder={module.columns[2]} />
          </div>
          <TextField label={module.columns[3]} placeholder={module.columns[3]} />
          <TextareaField label="Qeyd" placeholder="Daxili qeyd yaz" rows={5} />
        </section>
        <aside className="form-side">
          <section className="form-actions">
            <ButtonLink variant="secondary" to={module.route}>
              Ləğv et
            </ButtonLink>
            <Button type="button">{isEdit ? 'Yadda saxla' : 'Yarat'}</Button>
          </section>
        </aside>
      </form>
    </main>
  )
}
