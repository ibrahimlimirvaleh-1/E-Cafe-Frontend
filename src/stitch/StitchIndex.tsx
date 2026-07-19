import { Link } from 'react-router-dom'
import { stitchPages } from './stitchPages'

const groups = Array.from(new Set(stitchPages.map((page) => page.group)))

export function StitchIndex() {
  return (
    <main className="stitch-index">
      <header>
        <span>ECafe frontend</span>
        <h1>İnteqrasiya olunmuş Stitch səhifələri</h1>
        <p>HTML prototiplər app daxilində route-lara bağlanıb. Əsas axınlara birbaşa keçidlər və bütün səhifələr aşağıdadır.</p>
      </header>

      {groups.map((group) => (
        <section key={group}>
          <h2>{group}</h2>
          <div className="stitch-link-grid">
            {stitchPages
              .filter((page) => page.group === group)
              .map((page) => (
                <Link key={page.id} to={page.route ? `/${page.route}` : `/pages/${page.id}`}>
                  <strong>{page.label}</strong>
                  <small>{page.route ? `/${page.route}` : `/pages/${page.id}`}</small>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </main>
  )
}
