import { useParams } from 'react-router-dom'
import { stitchPages } from './stitchPages'

type StitchFramePageProps = {
  pageId?: string
}

export function StitchFramePage({ pageId }: StitchFramePageProps) {
  const params = useParams()
  const id = pageId ?? params.pageId
  const page = stitchPages.find((entry) => entry.id === id)

  if (!id || !page) {
    return (
      <main className="center-page">
        <article className="placeholder-panel">
          <h1>Stitch səhifə tapılmadı</h1>
        </article>
      </main>
    )
  }

  return <iframe className="stitch-frame" title={page.title} src={`/stitch-pages/${id}/code.html`} />
}
