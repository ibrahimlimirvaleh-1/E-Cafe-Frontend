import { Link } from 'react-router-dom'

type BrandProps = {
  admin?: boolean
}

export function Brand({ admin = false }: BrandProps) {
  return (
    <Link className="brand" to={admin ? '/admin' : '/'}>
      <img src="/ecafe-icon.png" alt="ECafe" />
      <strong>{admin ? 'ECafe Admin' : 'ECafe'}</strong>
    </Link>
  )
}
