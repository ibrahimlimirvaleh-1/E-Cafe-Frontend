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
    const brandContainer = brand.parentElement ?? brand
    const previousIcon = brand.previousElementSibling
    const existingImage = brandContainer.querySelector<HTMLImageElement>(
      'img[alt*="ECafe"], img[alt*="Logo"], .ecafe-brand-icon',
    )

    brandContainer.style.display = 'inline-flex'
    brandContainer.style.alignItems = 'center'
    brandContainer.style.gap = '8px'

    if (previousIcon?.classList.contains('material-symbols-outlined')) {
      previousIcon.remove()
    }

    if (existingImage) {
      existingImage.src = '/ecafe-icon.png'
      existingImage.alt = 'ECafe'
      existingImage.classList.add('ecafe-brand-icon')
      existingImage.style.width = existingImage.style.width || '32px'
      existingImage.style.height = existingImage.style.height || '32px'
      existingImage.style.objectFit = 'contain'
      return
    }

    const icon = brand.ownerDocument.createElement('img')
    icon.className = 'ecafe-brand-icon'
    icon.src = '/ecafe-icon.png'
    icon.alt = 'ECafe'
    icon.style.width = '32px'
    icon.style.height = '32px'
    icon.style.objectFit = 'contain'
    brand.before(icon)
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
