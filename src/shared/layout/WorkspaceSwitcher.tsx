import { ArrowRight, LayoutDashboard, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { UserAccessProfile } from '../auth/jwt'
import { RoleIds, getHomePathForRoleId } from '../auth/authz'

type WorkspaceSwitcherProps = {
  mode: 'site' | 'workspace'
}

const rolePanelLabels: Record<string, string> = {
  [RoleIds.PlatformAdmin]: 'Admin paneli',
  [RoleIds.Owner]: 'Sahibkar paneli',
  [RoleIds.Manager]: 'Menecer paneli',
  [RoleIds.Waiter]: 'Ofisiant paneli',
  [RoleIds.Kitchen]: 'Mətbəx paneli',
}

function profileLabel(profile: UserAccessProfile) {
  return [profile.roleName || rolePanelLabels[profile.roleId] || `Rol #${profile.roleId}`, profile.restaurantName].filter(Boolean).join(' · ')
}

function isWorkspaceProfile(profile: UserAccessProfile) {
  return profile.roleId !== RoleIds.Customer && Boolean(getHomePathForRoleId(profile.roleId))
}

export function WorkspaceSwitcher({ mode }: WorkspaceSwitcherProps) {
  const { isAuthenticated, selectProfile, user } = useAuth()

  if (!isAuthenticated || !user) {
    return null
  }

  const profiles = user.profiles.filter(isWorkspaceProfile)
  const currentProfile = profiles.find((profile) => profile.restaurantId === user.restaurantId && profile.roleId === user.roleId)
  const currentPath = getHomePathForRoleId(user.roleId)

  if (mode === 'workspace') {
    return (
      <Link className="workspace-switcher-home" to="/">
        <Store size={16} />
        <span>Əsas səhifə</span>
      </Link>
    )
  }

  if (profiles.length === 0 && !currentPath) {
    return null
  }

  if (profiles.length <= 1 && currentPath) {
    return (
      <Link className="workspace-switcher-home" to={currentPath}>
        <LayoutDashboard size={16} />
        <span>İş paneli</span>
      </Link>
    )
  }

  return (
    <details className="workspace-switcher">
      <summary>
        <LayoutDashboard size={16} />
        <span>İş panelinə keç</span>
      </summary>
      <div className="workspace-switcher-menu">
        <header>
          <strong>Keçid seç</strong>
          <small>Rol və restoran kontekstini seç.</small>
        </header>
        {profiles.map((profile) => {
          const isCurrent = currentProfile
            ? currentProfile.restaurantId === profile.restaurantId && currentProfile.roleId === profile.roleId
            : user.restaurantId === profile.restaurantId && user.roleId === profile.roleId
          const targetPath = getHomePathForRoleId(profile.roleId) || '/'

          return (
            <Link
              className="workspace-switcher-row"
              key={`${profile.restaurantId}:${profile.roleId}`}
              onClick={() => selectProfile(profile)}
              to={targetPath}
            >
              <span className="workspace-switcher-avatar">
                {(profile.restaurantName || profile.roleName || 'P').slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{profile.restaurantName || `Restoran #${profile.restaurantId}`}</strong>
                <small>{profileLabel(profile)}</small>
              </span>
              {isCurrent ? <em>Cari</em> : <ArrowRight size={16} />}
            </Link>
          )
        })}
      </div>
    </details>
  )
}
