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

  const onLogout = async () => {
    await logout()
    navigate('/login')
  }

  const activeProfile = user.profiles.find((profile) => profile.restaurantId === user.restaurantId && profile.roleId === user.roleId)
  const profileLabel = [user.roleName || `Rol #${user.roleId}`, activeProfile?.restaurantName].filter(Boolean).join(' · ')

  return (
    <div className="user-menu">
      <Link className="user-pill" to="/account" title="Profil">
        <UserRound size={16} />
        <span>
          <strong>
            {user.name} {user.surname}
          </strong>
          <small>{profileLabel}</small>
        </span>
      </Link>
      <button className="icon-action logout-action" type="button" title="Çıxış" onClick={() => void onLogout()}>
        <LogOut size={18} />
      </button>
    </div>
  )
}
