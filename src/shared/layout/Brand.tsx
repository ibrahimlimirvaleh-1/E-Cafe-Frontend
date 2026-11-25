import { Link } from 'react-router-dom'
import { useId } from 'react'
import './brand.css'

type BrandProps = {
  admin?: boolean
}

export function Brand({ admin = false }: BrandProps) {
  const filterId = `ecafe-logo-${useId().replace(/:/g, '')}`
  return (
    <Link className="brand" to={admin ? '/admin' : '/'} aria-label={admin ? 'ECafe Admin' : 'ECafe'}>
      <span className="brand-icon" aria-hidden="true">
        <img className="brand-icon-light" src="/ecafe-icon.png" alt="" />
        <svg className="brand-icon-dark" viewBox="0 0 512 512" focusable="false" aria-hidden="true">
          <defs>
            <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -0.2126 -0.7152 -0.0722 0 1" result="whiteInk" />
              <feComponentTransfer in="whiteInk" result="cleanInk"><feFuncA type="linear" slope="1.1" intercept="-0.1" /></feComponentTransfer>
              <feComposite in="cleanInk" in2="SourceAlpha" operator="in" result="logoInk" />
              <feMorphology in="logoInk" operator="dilate" radius="2" result="contour" />
              <feFlood floodColor="#000000" result="black" />
              <feComposite in="black" in2="contour" operator="in" result="blackContour" />
              <feMerge><feMergeNode in="blackContour" /><feMergeNode in="logoInk" /></feMerge>
            </filter>
          </defs>
          <image href="/ecafe-icon.png" width="512" height="512" filter={`url(#${filterId})`} />
        </svg>
      </span>
      <strong>{admin ? 'ECafe Admin' : 'ECafe'}</strong>
    </Link>
  )
}
