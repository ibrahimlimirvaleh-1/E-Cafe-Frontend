import { i18n } from '../i18n/i18n'
import { roleLabel } from '../i18n/roleLabel'
import { useTranslation } from 'react-i18next'
import { Building2, Check, ChevronDown, LogOut } from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getHomePathForRoleId } from '../auth/authz'
import { SafeImage } from '../ui/SafeImage'

function getUserInitials(name?: string, surname?: string) {
  return `${name?.trim().slice(0, 1) || ''}${surname?.trim().slice(0, 1) || ''}`.toUpperCase() || 'U'
}

export function UserMenu() {
  useTranslation()
  const { isAuthenticated, logout, selectProfile, user } = useAuth()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDetailsElement | null>(null)
  const menuPanelRef = useRef<HTMLDivElement | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ right: 16, top: 72 })

  const updateMenuPosition = () => {
    const summary = menuRef.current?.querySelector('summary')

    if (!summary) {
      return
    }

    const rect = summary.getBoundingClientRect()
    setMenuPosition({
      right: Math.max(12, window.innerWidth - rect.right),
      top: Math.round(rect.bottom + 10),
    })
  }

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (!menuRef.current?.contains(target) && !menuPanelRef.current?.contains(target)) {
        setIsProfileMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
      }
    }

    updateMenuPosition()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isProfileMenuOpen])

  if (!isAuthenticated || !user) {
    return (
      <Link className="ui-button ui-button-primary compact" to="/login">{i18n.t('ui.shared.layout.user_menu.daxil_ol_2e157a')}</Link>
    )
  }

  const onLogout = async () => {
    try {
      await logout()
    } catch {
      // Sessiya lokal olaraq təmizləndiyi üçün logout API xətası istifadəçini səhifədə saxlamamalıdır.
    } finally {
      navigate('/', { replace: true })
    }
  }

  const activeProfile = user.profiles.find((profile) => profile.restaurantId === user.restaurantId && profile.roleId === user.roleId)
  const profileLabel = [roleLabel(user.roleId, user.roleName), activeProfile?.restaurantName].filter(Boolean).join(' · ')
  const canSwitchProfile = user.profiles.length > 1
  const userInitials = getUserInitials(user.name, user.surname)
  const avatarAlt = `${user.name} ${user.surname}`.trim() || 'Profil'
  const renderUserAvatar = () => (user.fileUrl ? <SafeImage src={user.fileUrl} alt={avatarAlt} /> : <span className="user-avatar-initials">{userInitials}</span>)
  const profileMenuStyle = {
    '--profile-menu-right': `${menuPosition.right}px`,
    '--profile-menu-top': `${menuPosition.top}px`,
  } as CSSProperties

  const profileMenu = isProfileMenuOpen ? (
    <div className="user-profile-menu" ref={menuPanelRef} style={profileMenuStyle}>
      <header>
        <span>
          <em>{i18n.t('ui.shared.layout.user_menu.giris_profilleri_aa92c1')}</em>
          <strong>{i18n.t('ui.shared.layout.user_menu.hansi_restoranla_isleyirsiniz_67c63c')}</strong>
          <small>{i18n.t('ui.shared.layout.user_menu.secim_deyisende_panel_ve_melumatlar_he_48d907')}</small>
        </span>
        <Building2 size={18} />
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
                setIsProfileMenuOpen(false)
              }}
              type="button"
            >
              <div className="user-profile-avatar">{renderUserAvatar()}</div>
              <span>
                <strong>{profile.restaurantName || `Restoran #${profile.restaurantId}`}</strong>
                <small>{roleLabel(profile.roleId, profile.roleName)}</small>
              </span>
              {isCurrent ? (
                <span className="user-profile-current">
                  <Check size={14} />
                  {i18n.t('ui.shared.layout.user_menu.cari_e5ec52')}
                </span>
              ) : (
                <span className="user-profile-switch-label">{i18n.t('ui.shared.layout.user_menu.kec_7ab1f3')}</span>
              )}
            </button>
          )
        })}
      </div>
      <Link className="user-profile-account-link" onClick={() => setIsProfileMenuOpen(false)} to="/account">{i18n.t('ui.shared.layout.user_menu.profil_melumatlarina_bax_08ca8f')}</Link>
    </div>
  ) : null

  return (
    <div className="user-menu">
      {canSwitchProfile ? (
        <details className="user-profile-switcher" open={isProfileMenuOpen} ref={menuRef}>
          <summary
            className="user-pill"
            title={i18n.t('ui.shared.layout.user_menu.profil_ve_giris_konteksti_9215b1')}
            onClick={(event) => {
              event.preventDefault()
              updateMenuPosition()
              setIsProfileMenuOpen((current) => !current)
            }}
          >
            <div className="user-pill-avatar">{renderUserAvatar()}</div>
            <span>
              <strong>
                {user.name} {user.surname}
              </strong>
              <small>{profileLabel}</small>
            </span>
            <ChevronDown size={16} />
          </summary>
          {profileMenu ? createPortal(profileMenu, document.body) : null}
        </details>
      ) : (
        <Link className="user-pill" to="/account" title={i18n.t('ui.shared.layout.user_menu.profil_e267d3')}>
          <div className="user-pill-avatar">{renderUserAvatar()}</div>
          <span>
            <strong>
              {user.name} {user.surname}
            </strong>
            <small>{profileLabel}</small>
          </span>
        </Link>
      )}
      <button className="icon-action logout-action" type="button" title={i18n.t('ui.shared.layout.user_menu.cixis_c8abae')} onClick={() => void onLogout()}>
        <LogOut size={18} />
      </button>
    </div>
  )
}
