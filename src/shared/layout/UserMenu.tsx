import { Check, ChevronDown, LogOut, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getHomePathForRoleId } from '../auth/authz'
import type { UserAccessProfile } from '../auth/jwt'

function getProfileInitial(profile: UserAccessProfile) {
  return (profile.restaurantName || profile.roleName || 'P').slice(0, 1).toUpperCase()
}

export function UserMenu() {
  const { isAuthenticated, logout, selectProfile, user } = useAuth()
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
  const canSwitchProfile = user.profiles.length > 1

  return (
    <div className="user-menu">
      {canSwitchProfile ? (
        <details className="user-profile-switcher">
          <summary className="user-pill" title="Profil və giriş konteksti">
            <UserRound size={16} />
            <span>
              <strong>
                {user.name} {user.surname}
              </strong>
              <small>{profileLabel}</small>
            </span>
            <ChevronDown size={16} />
          </summary>
          <div className="user-profile-menu">
            <header>
              <strong>Giriş profilləri</strong>
              <small>Rol və restoran kontekstini dəyiş.</small>
            </header>
            <div className="user-profile-list">
              {user.profiles.map((profile) => {
                const isCurrent = profile.restaurantId === user.restaurantId && profile.roleId === user.roleId
                const targetPath = getHomePathForRoleId(profile.roleId) || '/'

                return (
                  <button
                    className={isCurrent ? 'user-profile-option active' : 'user-profile-option'}
                    key={`${profile.restaurantId}:${profile.roleId}`}
                    onClick={() => {
                      if (!isCurrent) {
                        selectProfile(profile)
                        navigate(targetPath)
                      }
                    }}
                    type="button"
                  >
                    <span className="user-profile-avatar">{getProfileInitial(profile)}</span>
                    <span>
                      <strong>{profile.restaurantName || `Restoran #${profile.restaurantId}`}</strong>
                      <small>{profile.roleName || `Rol #${profile.roleId}`}</small>
                    </span>
                    {isCurrent ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
            <Link className="user-profile-account-link" to="/account">
              Profil məlumatlarına bax
            </Link>
          </div>
        </details>
      ) : (
        <Link className="user-pill" to="/account" title="Profil">
          <UserRound size={16} />
          <span>
            <strong>
              {user.name} {user.surname}
            </strong>
            <small>{profileLabel}</small>
          </span>
        </Link>
      )}
      <button className="icon-action logout-action" type="button" title="Çıxış" onClick={() => void onLogout()}>
        <LogOut size={18} />
      </button>
    </div>
  )
}
