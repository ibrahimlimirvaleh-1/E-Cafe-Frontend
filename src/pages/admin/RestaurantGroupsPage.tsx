import { i18n } from '../../shared/i18n/i18n'
import { type FormEvent, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError, type ApiErrorDetail } from '../../shared/api/httpClient'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type RestaurantGroupsPageMode = 'list' | 'create'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function RestaurantGroupsPage({ mode = 'list' }: { mode?: RestaurantGroupsPageMode }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [messageDetails, setMessageDetails] = useState<ApiErrorDetail[]>([])
  const { data: groups, isLoading } = useKeyedAsyncData(() => ecafeApi.restaurantGroups.list(), [], 'groups', [reloadKey])
  const duplicateGroupEmail = groups.filter((group) => normalizeEmail(group.email || '') === normalizeEmail(email) && normalizeEmail(email).length > 0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setMessageDetails([])

    try {
      await ecafeApi.restaurantGroups.create({ name, legalName, email })
      setName('')
      setLegalName('')
      setEmail('')
      setMessage('Restoran qrupu yaradıldı.')
      setMessageDetails([])
      setReloadKey((value) => value + 1)
    } catch (err) {
      const feedback = normalizeCaughtApiError(err, 'Restoran qrupu yaradılmadı.')
      setMessage(feedback.message)
      setMessageDetails(feedback.details)
    }
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.restaurant_groups_page.admin_c1c224')}
        title={mode === 'create' ?i18n.t('ui.pages.admin.restaurant_groups_page.yeni_restoran_qrupu_45dc34') :i18n.t('ui.pages.admin.restaurant_groups_page.restoran_qruplari_a7544d')}
        action={mode === 'list' ? <ButtonLink to="/admin/restaurant-groups/new">{i18n.t('ui.pages.admin.restaurant_groups_page.yeni_qrup_e99889')}</ButtonLink> : <ButtonLink to="/admin/restaurant-groups" variant="secondary">{i18n.t('ui.pages.admin.restaurant_groups_page.siyahiya_qayit_f779ce')}</ButtonLink>}
      />

      <section className="admin-single-column staff-list-layout">
        {mode === 'create' ? (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">{i18n.t('ui.pages.admin.restaurant_groups_page.yeni_qrup_e99889')}</span>
              <h2>{i18n.t('ui.pages.admin.restaurant_groups_page.qrup_melumatlari_0c22cb')}</h2>
            </div>
            <TextField label={i18n.t('ui.pages.admin.restaurant_groups_page.qrup_adi_387ef9')} required value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label={i18n.t('ui.pages.admin.restaurant_groups_page.legal_ad_08f365')} value={legalName} onChange={(event) => setLegalName(event.target.value)} />
            <TextField label={i18n.t('ui.pages.admin.restaurant_groups_page.qrup_elaqe_emaili_dac066')} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            {duplicateGroupEmail.length > 0 ? (
              <div className="soft-warning-panel" role="status">
                <strong>{i18n.t('ui.pages.admin.restaurant_groups_page.bu_email_artiq_basqa_qrupda_istifade_o_0d0e24')}</strong>
                <span>
                  {duplicateGroupEmail.map((group) => group.name).join(', ')} {i18n.t('ui.pages.admin.restaurant_groups_page.qrupu_ile_eyni_elaqe_emaili_yazilib_du_89df15')}
                </span>
              </div>
            ) : null}
            <Button type="submit">{i18n.t('ui.pages.admin.restaurant_groups_page.qrup_yarat_7176e4')}</Button>
            {message ? <StatusMessage details={messageDetails}>{message}</StatusMessage> : null}
          </form>
        ) : (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">{i18n.t('ui.pages.admin.restaurant_groups_page.siyahi_3d2d8b')}</span>
              <h2>{i18n.t('ui.pages.admin.restaurant_groups_page.movcud_qruplar_5ca023')}</h2>
            </div>
            {isLoading ? <p className="online-only">{i18n.t('ui.pages.admin.restaurant_groups_page.qruplar_yuklenir_e5ff14')}</p> : null}
            <div className="compact-list">
              {groups.map((group) => (
                <article key={group.id}>
                  <div>
                    <strong>{group.name}</strong>
                    <small>{group.legalName || 'Legal ad qeyd edilməyib'}</small>
                    <small>{group.email || 'Email qeyd edilməyib'}</small>
                  </div>
                  <Badge tone={group.isActive ? 'success' : 'neutral'}>{group.isActive ?i18n.t('ui.pages.admin.restaurant_groups_page.aktiv_816345') :i18n.t('ui.pages.admin.restaurant_groups_page.deaktiv_477e77')}</Badge>
                </article>
              ))}
              {!isLoading && groups.length === 0 ? <p className="online-only">{i18n.t('ui.pages.admin.restaurant_groups_page.hele_restoran_qrupu_yoxdur_b1557a')}</p> : null}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export function RestaurantGroupCreatePage() {
  return <RestaurantGroupsPage mode="create" />
}
