import { Link } from 'react-router-dom'
import { Coffee } from 'lucide-react'
import './brand.css'

type BrandProps = {
  admin?: boolean
}

export function Brand({ admin = false }: BrandProps) {
  return (
    <Link className="brand" to={admin ? '/admin' : '/'} aria-label={admin ? 'ECafe Admin' : 'ECafe'}>
      <span className="brand-icon" aria-hidden="true">
        <Coffee fill="#ffffff" stroke="#111111" strokeWidth={3.2} />
        <Coffee fill="#ffffff" stroke="#ffffff" strokeWidth={1.4} />
      </span>
      <strong>{admin ? 'ECafe Admin' : 'ECafe'}</strong>
    </Link>
  )
}
