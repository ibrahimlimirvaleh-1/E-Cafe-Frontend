import { Link } from 'react-router-dom'

type BrandMarkProps = {
  admin?: boolean
}

export function BrandMark({ admin = false }: BrandMarkProps) {
  return (
    <Link className="sr-brand" to={admin ? '/admin' : '/'}>
      <img src="/ecafe-icon.png" alt="ECafe" />
      <span>{admin ? 'ECafe Admin' : 'ECafe'}</span>
    </Link>
  )
}
