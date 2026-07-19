import type { SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { stitchPages } from './stitchPages'

type StitchPageProps = {
  pageId?: string
}

export function StitchPage({ pageId }: StitchPageProps) {
  const params = useParams()
  const navigate = useNavigate()
  const id = pageId ?? params.pageId
  const page = stitchPages.find((item) => item.id === id)

  function getTargetRoute(label: string) {
    const text = label.toLowerCase()

    if (text.includes('login') || text.includes('daxil ol') || text.includes('giriş')) return '/login'
    if (text.includes('admin')) return '/admin'
    if (text.includes('ofisiant')) return '/waiter'
    if (text.includes('ana səhifə') || text.includes('restoranlar')) return '/'
    if (text.includes('rezervasiyalarım') || text.includes('rezervasiyalar')) return '/reservations'
    if (text.includes('növbəti addım') && id === 'masa_se_imi') return '/reserve/waiter'
    if (text.includes('növbəti addım') && id === 'ofisiant_se_imi') return '/reserve/menu'
    if (text.includes('ödəniş') || text.includes('tamamla')) return '/checkout'
    if (text.includes('rezerv et') || text.includes('masa seç')) return '/reserve/table'
    if (text.includes('detallara bax') || text.includes('ətraflı')) return '/restaurants/saffron-premium'
    if (text.includes('hamısını göstər')) return '/'

    return undefined
  }

  function wireFrameNavigation(event: SyntheticEvent<HTMLIFrameElement>) {
    const frameDocument = event.currentTarget.contentDocument

    if (!frameDocument) {
      return
    }

    frameDocument.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
      const href = anchor.getAttribute('href') ?? ''
      const target = getTargetRoute(anchor.textContent ?? '')

      if (href.startsWith('{{DATA:') || href === '#' || href === '') {
        anchor.setAttribute('href', target ?? '#')
      }
    })

    frameDocument.addEventListener('click', (clickEvent) => {
      const target = clickEvent.target as HTMLElement | null
      const action = target?.closest('a, button') as HTMLElement | null

      if (!action) {
        return
      }

      const route = getTargetRoute(action.textContent ?? '')

      if (route) {
        clickEvent.preventDefault()
        navigate(route)
      }
    })
  }

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
      onLoad={wireFrameNavigation}
    />
  )
}
