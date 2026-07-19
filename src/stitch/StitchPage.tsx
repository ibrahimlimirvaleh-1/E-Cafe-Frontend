import type { SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { stitchPages } from './stitchPages'

type StitchPageProps = {
  pageId?: string
}

const adminSidebarItems = [
  { label: 'Dashboard', icon: 'dashboard', route: '/admin' },
  { label: 'Restoranlar', icon: 'storefront', route: '/admin/restaurants' },
  { label: 'Müqavilələr', icon: 'description', route: '/admin/contracts' },
  { label: 'Rezervasiyalar', icon: 'book_online', route: '/admin/reservations' },
  { label: 'Sifarişlər', icon: 'receipt_long', route: '/admin/orders' },
  { label: 'Ödənişlər', icon: 'payments', route: '/admin/payments' },
  { label: 'Personal', icon: 'group', route: '/admin/staff' },
  { label: 'Masalar', icon: 'table_restaurant', route: '/admin/tables' },
  { label: 'Kateqoriyalar', icon: 'category', route: '/admin/categories' },
  { label: 'Menyu', icon: 'restaurant_menu', route: '/admin/menu' },
  { label: 'Mətbəx', icon: 'kitchen', route: '/kitchen' },
  { label: 'Ofisiant', icon: 'room_service', route: '/waiter' },
]

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
    const text = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (isAdminSurface) {
      if (text.includes('dashboard') || text.includes('idareetme paneli')) return '/admin'
      if (text.includes('restoranlar')) return '/admin/restaurants'
      if (text.includes('muqavil')) return '/admin/contracts'
      if (text.includes('sifaris')) return '/admin/orders'
      if (text.includes('odenis')) return '/admin/payments'
      if (text.includes('personal') || text.includes('emekdas')) return '/admin/staff'
      if (text.includes('masalar') || text.includes('masa')) return '/admin/tables'
      if (text.includes('kateqoriya')) return '/admin/categories'
      if (text.includes('menyu')) return '/admin/menu'
      if (text.includes('metbex')) return '/kitchen'
    }

    if (text.includes('login') || text.includes('daxil ol') || text.includes('giris')) return '/login'
    if (text.includes('admin')) return '/admin'
    if (text.includes('ofisiant')) return '/waiter'
    if (text.includes('ana sehife') || text.includes('restoranlar')) return '/'
    if (text.includes('rezervasiyalarim') || text.includes('rezervasiyalar')) return '/reservations'
    if (text.includes('novbeti addim') && id === 'masa_se_imi') return '/reserve/waiter'
    if (text.includes('novbeti addim') && id === 'ofisiant_se_imi') return '/reserve/menu'
    if (text.includes('odenis') || text.includes('tamamla')) return '/checkout'
    if (text.includes('rezerv et') || text.includes('masa sec')) return '/reserve/table'
    if (text.includes('detallara bax') || text.includes('etrafli')) return '/restaurants/saffron-premium'
    if (text.includes('hamisini goster')) return '/'

    return undefined
  }

  function wireFrameNavigation(event: SyntheticEvent<HTMLIFrameElement>) {
    const frameDocument = event.currentTarget.contentDocument

    if (!frameDocument) {
      return
    }

    normalizeFrameBrand(frameDocument)
    normalizeAdminSidebar(frameDocument)

    frameDocument.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
      const href = anchor.getAttribute('href') ?? ''
      const target = anchor.dataset.ecafeRoute ?? getTargetRoute(anchor.textContent ?? '')

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

      const route = action.dataset.ecafeRoute ?? getTargetRoute(action.textContent ?? '')

      if (route) {
        clickEvent.preventDefault()
        navigate(route)
      }
    })
  }

  function normalizeAdminSidebar(frameDocument: Document) {
    if (!isAdminSurface) {
      return
    }

    injectAdminSidebarStyles(frameDocument)
    removeExistingAdminSidebars(frameDocument)

    const sidebar = frameDocument.createElement('aside')
    const brand = frameDocument.createElement('a')
    const brandIcon = frameDocument.createElement('img')
    const brandText = frameDocument.createElement('span')
    const nav = frameDocument.createElement('nav')
    const currentRoute = normalizeRoute(`/${page?.route ?? ''}`)

    sidebar.className = 'ecafe-admin-sidebar'
    brand.className = 'ecafe-admin-sidebar-brand'
    brand.href = '/admin'
    brand.dataset.ecafeRoute = '/admin'
    brandIcon.src = '/ecafe-icon.png'
    brandIcon.alt = 'ECafe'
    brandText.textContent = 'ECafe Admin'
    brand.append(brandIcon, brandText)

    adminSidebarItems.forEach((item) => {
      const link = frameDocument.createElement('a')
      const icon = frameDocument.createElement('span')
      const label = frameDocument.createElement('span')
      const route = normalizeRoute(item.route)

      link.className = route === currentRoute ? 'active' : ''
      link.href = item.route
      link.dataset.ecafeRoute = item.route
      icon.className = 'material-symbols-outlined'
      icon.textContent = item.icon
      label.textContent = item.label
      link.append(icon, label)
      nav.append(link)
    })

    sidebar.append(brand, nav)
    frameDocument.body.prepend(sidebar)
    frameDocument.body.classList.add('ecafe-admin-shell')
  }

  function normalizeRoute(route: string) {
    return route.replace(/\/$/, '')
  }

  function injectAdminSidebarStyles(frameDocument: Document) {
    if (frameDocument.getElementById('ecafe-admin-sidebar-style')) {
      return
    }

    const style = frameDocument.createElement('style')
    style.id = 'ecafe-admin-sidebar-style'
    style.textContent = `
      .ecafe-hidden-sidebar { display: none !important; }
      .ecafe-admin-sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 2147483000;
        width: 256px;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border-right: 1px solid #e1e3e4;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
      }
      .ecafe-admin-sidebar-brand {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 72px;
        padding: 0 24px;
        color: #000000;
        font: 700 22px/28px Inter, system-ui, sans-serif;
        text-decoration: none;
        white-space: nowrap;
      }
      .ecafe-admin-sidebar-brand img {
        width: 30px;
        height: 30px;
        object-fit: contain;
      }
      .ecafe-admin-sidebar nav {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
        padding: 8px 12px 20px;
      }
      .ecafe-admin-sidebar nav a {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 44px;
        padding: 10px 12px;
        border-radius: 10px;
        color: #45464c;
        font: 500 14px/20px Inter, system-ui, sans-serif;
        text-decoration: none;
        cursor: pointer;
      }
      .ecafe-admin-sidebar nav a:hover,
      .ecafe-admin-sidebar nav a.active {
        background: #fff0d8;
        color: #000000;
      }
      .ecafe-admin-sidebar nav .material-symbols-outlined {
        font-size: 20px;
      }
      @media (max-width: 767px) {
        .ecafe-admin-sidebar { display: none; }
      }
    `
    frameDocument.head.append(style)
  }

  function removeExistingAdminSidebars(frameDocument: Document) {
    frameDocument.querySelectorAll<HTMLElement>('aside, nav, [class*="sidebar"], [class*="SideNav"]').forEach((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').toLowerCase() ?? ''

      if (
        text.includes('ecafe admin') ||
        text.includes('dashboard') ||
        text.includes('restoranlar') ||
        text.includes('muqavil') ||
        text.includes('müqavil') ||
        text.includes('masalar')
      ) {
        element.classList.add('ecafe-hidden-sidebar')
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
