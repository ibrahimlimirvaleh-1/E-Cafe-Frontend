import { i18n } from '../../shared/i18n/i18n'
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
          <h1>{i18n.t('ui.pages.stitch.stitch_frame_page.stitch_sehife_tapilmadi_ce7964')}</h1>
        </article>
      </main>
    )
  }

  return <iframe className="stitch-frame" title={page.title} src={`/stitch-pages/${id}/code.html`} />
}
