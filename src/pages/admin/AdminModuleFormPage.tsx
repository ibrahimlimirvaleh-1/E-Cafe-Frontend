import { i18n } from '../../shared/i18n/i18n'
import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { useTranslation } from 'react-i18next'
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

const statusKeys: Record<string, string> = {
  'Depozit gözləyir': 'pendingDeposit',
  'Rezerv edilib': 'reserved',
  Oturub: 'seated',
  'Tamamlanıb': 'completed',
  'Ləğv edilib': 'cancelled',
  'Gəlmədi': 'noShow',
  'Yaradılıb': 'created',
  'Qəbul edilib': 'accepted',
  'Hazırlanır': 'preparing',
  'Hazırdır': 'ready',
  'Servis edilib': 'served',
  'Bağlanıb': 'closed',
  'Gözləyir': 'pending',
  'Ödənilib': 'paid',
  'Uğursuz': 'failed',
  'Geri qaytarılıb': 'refunded',
  Aktiv: 'active',
  Deaktiv: 'inactive',
  'Boşdur': 'available',
  'Məşğuldur': 'occupied',
  'Gizlidir': 'hidden',
  'Satışdadır': 'onSale',
  'Müvəqqəti yoxdur': 'temporarilyUnavailable',
}

export function AdminModuleFormPage({ mode, moduleKey }: AdminModuleFormPageProps) {
  useTranslation()
  const module = getAdminModule(moduleKey)
  const isEdit = mode === 'edit'
  const statuses = statusOptions[moduleKey] ?? ['Aktiv', 'Deaktiv']

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={isEdit ?i18n.t('ui.pages.admin.admin_module_form_page.redakte_af7c03') :i18n.t('ui.pages.admin.admin_module_form_page.yeni_qeyd_2af8e9')}
        title={isEdit ? `${module.singular} redaktə et` : module.createLabel ?? `${module.singular} yarat`}
      />
      <form className="form-layout">
        <section className="form-card">
          <TextField label={`${module.singular} adı`} placeholder={module.singular} defaultValue={isEdit ? `Demo ${module.singular}` : ''} />
          <div className="form-row">
            <SelectField label={i18n.t('ui.pages.admin.admin_module_form_page.status_920e41')} defaultValue={statuses[0]}>
              {statuses.map((status) => (
                <option key={status} value={status}>{i18n.t(`ui.adminStatus.${statusKeys[status]}`, { defaultValue: status })}</option>
              ))}
            </SelectField>
            <TextField label={module.columns[2]} placeholder={module.columns[2]} />
          </div>
          <TextField label={module.columns[3]} placeholder={module.columns[3]} />
          <TextareaField label={i18n.t('ui.pages.admin.admin_module_form_page.qeyd_5579df')} placeholder={i18n.t('ui.pages.admin.admin_module_form_page.daxili_qeyd_yaz_7ce183')} rows={5} />
        </section>
        <aside className="form-side">
          <section className="form-actions">
            <ButtonLink variant="secondary" to={module.route}>{i18n.t('ui.pages.admin.admin_module_form_page.legv_et_94727e')}</ButtonLink>
            <Button type="button">{isEdit ?i18n.t('ui.pages.admin.admin_module_form_page.yadda_saxla_78db97') :i18n.t('ui.pages.admin.admin_module_form_page.yarat_680941')}</Button>
          </section>
        </aside>
      </form>
    </main>
  )
}
