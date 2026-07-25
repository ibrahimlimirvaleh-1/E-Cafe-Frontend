import { LogOut, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function UserMenu() {
  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()

  if (!isAuthenticated || !user) {
    return (
      <Link className="ui-button ui-button-primary compact" to="/login">
        Daxil ol
      </Link>
    )
  }

  const onLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="user-menu">
      <Link className="user-pill" to="/account" title="Profil">
        <UserRound size={16} />
        <span>
          <strong>
            {user.name} {user.surname}
          </strong>
          <small>{user.roleName || `Rol #${user.roleId}`}</small>
        </span>
      </Link>
      <button className="icon-action" type="button" title="Çıxış" onClick={onLogout}>
        <LogOut size={18} />
      </button>
    </div>
  )
}
