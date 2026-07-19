import { Link } from 'react-router-dom'
import { stitchPages } from './stitchPages'

export function StitchIndexPage() {
  return (
    <main className="stitch-index">
      <header>
        <span>Stitch referans</span>
        <h1>Original dizayn preview-ları</h1>
        <p>Bu bölmədə orijinal dizayn ekranlarını müqayisə üçün görə bilərsən.</p>
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
