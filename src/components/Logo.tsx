import { NavLink } from 'react-router-dom'

export function Logo() {
  return (
    <NavLink className="logo" to="/">
      <span className="logo-mark">E</span>
      <span>
        <strong>ECafe</strong>
        <small>Reservation OS</small>
      </span>
    </NavLink>
  )
}
