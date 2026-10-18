import { i18n } from '../../shared/i18n/i18n'
import { Link } from 'react-router-dom'
import { stitchPages } from './stitchPages'

export function StitchIndexPage() {
  return (
    <main className="stitch-index">
      <header>
        <span>{i18n.t('ui.pages.stitch.stitch_index_page.stitch_referans_85c19c')}</span>
        <h1>{i18n.t('ui.pages.stitch.stitch_index_page.original_dizayn_preview_lari_623bdc')}</h1>
        <p>{i18n.t('ui.pages.stitch.stitch_index_page.bu_bolmede_orijinal_dizayn_ekranlarini_b254fb')}</p>
      </header>
      <section className="stitch-link-grid">
        {stitchPages.map((page) => (
          <Link key={page.id} to={`/pages/${page.id}`}>
            <strong>{page.title}</strong>
            <small>{page.route ?? page.id}</small>
          </Link>
        ))}
      </section>
    </main>
  )
}
