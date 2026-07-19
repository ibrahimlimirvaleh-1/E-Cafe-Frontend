import { Link, NavLink } from 'react-router-dom'
import { BrandMark } from './BrandMark'

export function SiteHeader() {
  return (
    <header className="sr-topbar">
      <div className="sr-topbar-inner">
        <BrandMark />
        <nav className="sr-nav" aria-label="Əsas menyu">
          <NavLink to="/">Ana Səhifə</NavLink>
          <NavLink to="/pages/restoran_kataloqu">Axtarış</NavLink>
          <NavLink to="/reservations">Rezervasiyalar</NavLink>
          <NavLink to="/account">Profil</NavLink>
        </nav>
        <Link className="sr-login-button" to="/login">
          Daxil ol
        </Link>
      </div>
    </header>
  )
}
