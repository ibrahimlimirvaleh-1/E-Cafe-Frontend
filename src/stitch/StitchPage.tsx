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
  const isAdminSurface = Boolean(
    page?.route?.startsWith('admin') ||
      page?.group.includes('Admin') ||
      page?.group === 'Contracts' ||
      page?.group === 'Tables' ||
      page?.group === 'Categories' ||
      page?.group === 'Menu',
  )

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

    normalizeFrameBrand(frameDocument)

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

  function normalizeFrameBrand(frameDocument: Document) {
    const brandLabel = isAdminSurface ? 'ECafe Admin' : 'ECafe'

    replaceFrameLogoImages(frameDocument)

    if (id === 'giri_qeydiyyat') {
      frameDocument.querySelector('header')?.remove()
      return
    }

    const brandCandidates = Array.from(
      frameDocument.querySelectorAll<HTMLElement>('h1, h2, h3, span, div, a'),
    ).filter((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? ''

      return /e-?cafe/i.test(text) && text.length <= 32
    })

    if (brandCandidates.length === 0) {
      const shell = frameDocument.querySelector<HTMLElement>('header, aside, nav, body')
      const brand = frameDocument.createElement('div')
      brand.className = 'ecafe-normalized-brand'
      brand.textContent = brandLabel
      shell?.prepend(brand)
      ensureBrandIcon(brand)
      return
    }

    brandCandidates.forEach((brand) => {
      brand.textContent = brandLabel
      ensureBrandIcon(brand)
    })
  }

  function replaceFrameLogoImages(frameDocument: Document) {
    frameDocument.querySelectorAll<HTMLImageElement>('img[alt*="ECafe"], img[alt*="Logo"]').forEach((image) => {
      image.src = '/ecafe-icon.png'
      image.alt = 'ECafe'
      image.style.objectFit = 'contain'
    })
  }

  function ensureBrandIcon(brand: HTMLElement) {
    const frameDocument = brand.ownerDocument
    const chrome = brand.closest<HTMLElement>('header, aside, nav') ?? brand.parentElement ?? brand
    const previousIcon = brand.previousElementSibling
    const firstLogo = chrome.querySelector<HTMLElement>('img[alt*="ECafe"], img[alt*="Logo"], .ecafe-brand-icon')
    const wrapper = frameDocument.createElement('span')
    const icon = frameDocument.createElement('img')
    const insertionTarget = firstLogo ?? brand

    if (previousIcon?.classList.contains('material-symbols-outlined')) {
      previousIcon.remove()
    }

    icon.className = 'ecafe-brand-icon'
    icon.src = '/ecafe-icon.png'
    icon.alt = 'ECafe'
    icon.style.width = '28px'
    icon.style.height = '28px'
    icon.style.objectFit = 'contain'
    icon.style.marginRight = '0'
    icon.style.paddingRight = '0'

    wrapper.className = 'ecafe-brand-lockup'
    wrapper.style.display = 'inline-flex'
    wrapper.style.alignItems = 'center'
    wrapper.style.gap = '4px'
    wrapper.style.width = 'max-content'
    wrapper.style.flex = '0 0 auto'

    brand.style.margin = '0'
    brand.style.paddingLeft = '0'
    brand.style.display = 'inline-block'
    brand.style.whiteSpace = 'nowrap'

    insertionTarget.before(wrapper)
    wrapper.append(icon, brand)

    chrome.querySelectorAll('img[alt*="ECafe"], img[alt*="Logo"], .ecafe-brand-icon').forEach((image) => {
      if (image !== icon) {
        image.remove()
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
