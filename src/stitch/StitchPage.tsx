import { Link, useParams } from 'react-router-dom'
import { stitchPages } from './stitchPages'

type StitchPageProps = {
  pageId?: string
}

export function StitchPage({ pageId }: StitchPageProps) {
  const params = useParams()
  const id = pageId ?? params.pageId
  const page = stitchPages.find((item) => item.id === id)

  if (!page) {
    return (
      <main className="stitch-missing">
        <h1>Səhifə tapılmadı</h1>
        <p>Bu Stitch səhifəsi app daxilində qeydiyyatdan keçməyib.</p>
        <Link to="/pages">Bütün səhifələrə qayıt</Link>
      </main>
    )
  }

  return (
    <iframe
      className="stitch-frame"
      src={`/stitch-pages/${page.id}/code.html`}
      title={page.label}
    />
  )
}
