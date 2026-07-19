import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { SelectField, TextareaField, TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'

type AdminModuleFormPageProps = {
  moduleKey: AdminModuleKey
  mode: 'create' | 'edit'
}

export function AdminModuleFormPage({ mode, moduleKey }: AdminModuleFormPageProps) {
  const module = getAdminModule(moduleKey)
  const isEdit = mode === 'edit'

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={isEdit ? 'Redaktə' : 'Yeni qeyd'}
        title={isEdit ? `${module.singular} redaktə et` : module.createLabel ?? `${module.singular} yarat`}
        description="Əsas məlumatları doldur, statusu seç və dəyişiklikləri saxla."
      />
      <form className="form-layout">
        <section className="form-card">
          <TextField label={`${module.singular} adı`} placeholder={module.singular} defaultValue={isEdit ? `Demo ${module.singular}` : ''} />
          <div className="form-row">
            <TextField label="Qeyd nömrəsi" placeholder="Avtomatik yaradılacaq" defaultValue={isEdit ? 'EC-2026-001' : ''} />
            <SelectField label="Status" defaultValue="Active">
              <option>Active</option>
              <option>PendingSignature</option>
              <option>Draft</option>
              <option>Inactive</option>
            </SelectField>
          </div>
          <div className="form-row">
            <TextField label={module.columns[2]} placeholder={module.columns[2]} />
            <TextField label={module.columns[3]} placeholder={module.columns[3]} />
          </div>
          <TextareaField label="Qeyd" placeholder="Audit üçün qısa qeyd yaz" rows={5} />
        </section>
        <aside className="form-side">
          <section className="form-card">
            <h2>Biznes qaydaları</h2>
            <p>Aktiv müqaviləsi olmayan restoran rezervasiya və online ödəniş qəbul edə bilməz.</p>
          </section>
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
