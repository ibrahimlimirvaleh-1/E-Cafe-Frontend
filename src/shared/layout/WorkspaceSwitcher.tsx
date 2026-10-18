import { i18n } from '../i18n/i18n'
import { ArrowRight, LayoutDashboard, Store, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false)

  useEffect(() => {
    if (!isPanelModalOpen) {
      return undefined
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPanelModalOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isPanelModalOpen])

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
        <span>{i18n.t('ui.shared.layout.workspace_switcher.esas_sehife_784c75')}</span>
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
        <span>{i18n.t('ui.shared.layout.workspace_switcher.is_paneli_84f24b')}</span>
      </Link>
    )
  }

  const panelModal = isPanelModalOpen ? (
    <div className="modal-backdrop workspace-panel-backdrop" role="presentation" onClick={() => setIsPanelModalOpen(false)}>
      <section
        aria-labelledby="workspace-panel-title"
        className="workspace-panel-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <span>
            <strong id="workspace-panel-title">{i18n.t('ui.shared.layout.workspace_switcher.is_paneli_sec_437572')}</strong>
            <small>{i18n.t('ui.shared.layout.workspace_switcher.rol_ve_restoran_kontekstini_sec_e37e8d')}</small>
          </span>
          <button className="icon-action" type="button" title={i18n.t('ui.shared.layout.workspace_switcher.bagla_c1cf91')} onClick={() => setIsPanelModalOpen(false)}>
            <X size={18} />
          </button>
        </header>
        <div className="workspace-panel-list">
          {profiles.map((profile) => {
            const isCurrent = currentProfile
              ? currentProfile.restaurantId === profile.restaurantId && currentProfile.roleId === profile.roleId
              : user.restaurantId === profile.restaurantId && user.roleId === profile.roleId
            const targetPath = getHomePathForRoleId(profile.roleId) || '/'

            return (
              <button
                className={isCurrent ? 'workspace-panel-row active' : 'workspace-panel-row'}
                key={`${profile.restaurantId}:${profile.roleId}`}
                onClick={() => {
                  selectProfile(profile)
                  setIsPanelModalOpen(false)
                  navigate(targetPath)
                }}
                type="button"
              >
                <span className="workspace-switcher-avatar">
                  {(profile.restaurantName || profile.roleName || 'P').slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{profile.restaurantName || `Restoran #${profile.restaurantId}`}</strong>
                  <small>{profileLabel(profile)}</small>
                </span>
                {isCurrent ? <em>{i18n.t('ui.shared.layout.workspace_switcher.cari_e5ec52')}</em> : <ArrowRight size={16} />}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  ) : null

  return (
    <div className="workspace-switcher">
      <button className="workspace-switcher-trigger" type="button" onClick={() => setIsPanelModalOpen(true)}>
        <LayoutDashboard size={16} />
        <span>{i18n.t('ui.shared.layout.workspace_switcher.is_paneline_kec_bfee0c')}</span>
      </button>
      {panelModal ? createPortal(panelModal, document.body) : null}
    </div>
  )
}
