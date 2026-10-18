import { i18n } from '../shared/i18n/i18n'
import { ButtonLink } from '../shared/ui/Button'

export function NotFoundPage() {
  return (
    <main className="center-page">
      <article className="placeholder-panel">
        <h1>{i18n.t('ui.pages.not_found_page.sehife_tapilmadi_34d841')}</h1>
        <p>{i18n.t('ui.pages.not_found_page.bu_route_ucun_frontend_sehifesi_hele_m_24a343')}</p>
        <ButtonLink to="/">{i18n.t('ui.pages.not_found_page.ana_sehife_611a04')}</ButtonLink>
      </article>
    </main>
  )
}
