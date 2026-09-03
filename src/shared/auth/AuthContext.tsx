import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserFromToken } from './jwt'
import type { CurrentUser, UserAccessProfile } from './jwt'
import { clearAuthTokens, getAccessToken, hasManualLogoutMarker, markManualLogout, saveAuthTokens } from './tokenStorage'
import type { AuthTokens } from './tokenStorage'
import { ecafeApi } from '../api/ecafeApi'
import { refreshAccessToken } from '../api/httpClient'
import { createUserSessionEventsConnection } from '../realtime/userSessionEvents'
import { getHomePathForUser } from './authz'
import { profileKey, readStoredProfileKey, writeStoredProfileKey } from './activeProfileStorage'

const SESSION_TERMINATED_MESSAGE = 'Hesabınız deaktiv edilib. Sistemə girişiniz dayandırıldı.'
const ROLE_CHANGED_MESSAGE = 'Rolunuz dəyişdirildi. Sessiya məlumatları yenilənir.'
const RESTAURANT_ACCESS_CHANGED_MESSAGE = 'Restoran üzrə icazələr yeniləndi. Səhifə yenilənir.'
const SESSION_NOTICE_STORAGE_KEY = 'ecafe.sessionNotice'
const SESSION_RECONCILE_INTERVAL_MS = 60_000

const roleNamesById: Record<string, string> = {
  1: 'Platforma super administratoru',
  2: 'Sahibkar',
  3: 'Menecer',
  4: 'Ofisiant',
  5: 'Müştəri',
  6: 'Mətbəx',
}

type SessionNotice = {
  title: string
  message: string
}

type AuthContextValue = {
  user: CurrentUser | null
  isAuthReady: boolean
  isAuthenticated: boolean
  setSession: (tokens: AuthTokens) => void
  updateUser: (patch: Partial<CurrentUser>) => void
  selectProfile: (profile: Pick<UserAccessProfile, 'restaurantId' | 'roleId'>) => void
  selectProfileForRestaurant: (restaurantId: string) => void
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function hasStoredProfile(user: CurrentUser) {
  const storedProfileKey = readStoredProfileKey(user.userId)
  return Boolean(storedProfileKey && user.profiles.some((profile) => profileKey(profile) === storedProfileKey))
}

function withSelectedProfile(user: CurrentUser | null, preferredProfile?: Pick<UserAccessProfile, 'restaurantId' | 'roleId'> | null) {
  if (!user) {
    return null
  }

  const profiles: UserAccessProfile[] = user.profiles.length > 0
    ? user.profiles
    : user.restaurantRoles.map((assignment) => ({ ...assignment }))

  if (profiles.length === 0) {
    return user
  }

  const storedProfileKey = readStoredProfileKey(user.userId)
  const selectedProfile =
    (preferredProfile
      ? profiles.find((profile) => profile.restaurantId === preferredProfile.restaurantId && profile.roleId === preferredProfile.roleId)
      : null) ||
    profiles.find((profile) => profileKey(profile) === storedProfileKey) ||
    profiles.find((profile) => profile.restaurantId === user.restaurantId && profile.roleId === user.roleId) ||
    profiles[0]

  return {
    ...user,
    restaurantId: selectedProfile.restaurantId,
    roleId: selectedProfile.roleId,
    roleName: selectedProfile.roleName || roleNamesById[selectedProfile.roleId] || user.roleName,
    profiles,
  }
}

function profileSignature(profiles: UserAccessProfile[]) {
  return profiles
    .map((profile) => `${profile.restaurantId}:${profile.roleId}:${profile.restaurantName || ''}:${profile.roleName || ''}:${profile.isActive !== false}`)
    .sort()
    .join('|')
}

function mergeProfileDetails(
  user: CurrentUser,
  profileDetails: {
    fileUrl?: string
    profiles?: Array<{ restaurantId: string; restaurantName: string; roleId: number; roleName: string; isActive: boolean }>
  },
) {
  const detailedProfiles = (profileDetails.profiles || [])
    .filter((profile) => profile.isActive && profile.restaurantId && profile.roleId)
    .map((profile) => ({
      restaurantId: String(profile.restaurantId),
      restaurantName: profile.restaurantName,
      roleId: String(profile.roleId),
      roleName: profile.roleName,
      isActive: profile.isActive,
    }))

  if (detailedProfiles.length === 0) {
    return user
  }

  const nextUser = withSelectedProfile({ ...user, fileUrl: profileDetails.fileUrl || user.fileUrl, profiles: detailedProfiles })
  return nextUser ?? user
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const didBootstrapSessionRef = useRef(false)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  const profilePromptUserIdRef = useRef('')
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null)
  const [isProfilePromptOpen, setIsProfilePromptOpen] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const token = getAccessToken()
    return token ? withSelectedProfile(getUserFromToken(token)) : null
  })
  const [isAuthReady, setIsAuthReady] = useState(() => Boolean(getAccessToken()))

  const showSessionNotice = useCallback((notice: SessionNotice, autoHideMs: number | false = 2000) => {
    window.clearTimeout(noticeTimerRef.current)
    setSessionNotice(notice)

    if (autoHideMs !== false) {
      noticeTimerRef.current = window.setTimeout(() => {
        setSessionNotice(null)
      }, autoHideMs)
    }
  }, [])

  const showPersistentSessionNotice = useCallback((notice: SessionNotice, autoHideMs: number | false = 2000) => {
    window.sessionStorage.setItem(SESSION_NOTICE_STORAGE_KEY, JSON.stringify(notice))
    showSessionNotice(notice, autoHideMs)
  }, [showSessionNotice])

  useEffect(() => {
    return () => window.clearTimeout(noticeTimerRef.current)
  }, [])

  useEffect(() => {
    const storedNotice = window.sessionStorage.getItem(SESSION_NOTICE_STORAGE_KEY)
    if (!storedNotice) {
      return
    }

    window.sessionStorage.removeItem(SESSION_NOTICE_STORAGE_KEY)

    try {
      const notice = JSON.parse(storedNotice) as Partial<SessionNotice>
      if (typeof notice.title === 'string' && typeof notice.message === 'string') {
        showSessionNotice({
          title: notice.title,
          message: notice.message,
        }, 2000)
      }
    } catch {
      window.sessionStorage.removeItem(SESSION_NOTICE_STORAGE_KEY)
    }
  }, [showSessionNotice])

  useEffect(() => {
    if (didBootstrapSessionRef.current || user || getAccessToken()) {
      return
    }

    if (hasManualLogoutMarker()) {
      setIsAuthReady(true)
      return
    }

    didBootstrapSessionRef.current = true
    let isCurrent = true

    async function restoreSessionFromCookie() {
      try {
        const tokens = await refreshAccessToken({ notifyOnFailure: false })
        const restoredUser = tokens ? getUserFromToken(tokens.accessToken) : null

        if (isCurrent && restoredUser) {
          setUser(withSelectedProfile(restoredUser))
        }
      } finally {
        if (isCurrent) {
          setIsAuthReady(true)
        }
      }
    }

    void restoreSessionFromCookie()

    return () => {
      isCurrent = false
    }
  }, [user])

  useEffect(() => {
    function terminateSession(message = SESSION_TERMINATED_MESSAGE) {
      showSessionNotice({
        title: 'Giriş dayandırıldı',
        message,
      }, false)
      clearAuthTokens()
      setUser(null)

      window.setTimeout(() => {
        if (window.location.pathname !== '/') {
          window.location.assign('/')
        }
      }, 1200)
    }

    function handleAuthExpired(event: Event) {
      const message = event instanceof CustomEvent && typeof event.detail?.message === 'string'
        ? event.detail.message
        : SESSION_TERMINATED_MESSAGE

      terminateSession(message)
    }

    window.addEventListener('ecafe:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('ecafe:auth-expired', handleAuthExpired)
  }, [showSessionNotice])

  useEffect(() => {
    if (!user || !getAccessToken()) {
      return
    }

    let isCurrent = true
    const currentUser = user

    async function reconcileStoredSession(showChangeNotice = false) {
      const profile = await ecafeApi.profile.get()

      if (!isCurrent || !getAccessToken()) {
        return
      }

      if (!profile) {
        return
      }

      if (profile?.isActive === false) {
        showSessionNotice({
          title: 'Giriş dayandırıldı',
          message: SESSION_TERMINATED_MESSAGE,
        }, false)
        clearAuthTokens()
        setUser(null)
        window.setTimeout(() => window.location.assign('/'), 1200)
        return
      }

      setUser((current) => {
        if (!current) {
          return current
        }

        const nextUser = mergeProfileDetails(current, profile)
        return profileSignature(nextUser.profiles) === profileSignature(current.profiles) &&
          nextUser.restaurantId === current.restaurantId &&
          nextUser.roleId === current.roleId
          ? current
          : nextUser
      })

      const profileRestaurantRoles = profile.profiles.map((item) => `${item.restaurantId}:${item.roleId}`).sort().join(',')
      const tokenRestaurantRoles = currentUser.restaurantRoles.map((item) => `${item.restaurantId}:${item.roleId}`).sort().join(',')
      const sessionChanged =
        profile.profiles.length > 0
          ? profileRestaurantRoles !== tokenRestaurantRoles
          : false

      if (!sessionChanged) {
        return
      }

      const refreshedTokens = await refreshAccessToken({ notifyOnFailure: false })
      const refreshedUser = refreshedTokens ? getUserFromToken(refreshedTokens.accessToken) : null

      if (!isCurrent || !refreshedUser) {
        return
      }

      setUser(withSelectedProfile(refreshedUser))

      if (showChangeNotice) {
        showPersistentSessionNotice({
          title: 'Sessiya yeniləndi',
          message: 'İcazə və rol məlumatlarınız yeniləndi.',
        }, 2000)
      }
    }

    function reconcileWhenVisible() {
      if (document.visibilityState === 'visible') {
        void reconcileStoredSession(true)
      }
    }

    void reconcileStoredSession()
    window.addEventListener('focus', reconcileWhenVisible)
    document.addEventListener('visibilitychange', reconcileWhenVisible)
    const intervalId = window.setInterval(() => {
      void reconcileStoredSession()
    }, SESSION_RECONCILE_INTERVAL_MS)

    return () => {
      isCurrent = false
      window.removeEventListener('focus', reconcileWhenVisible)
      document.removeEventListener('visibilitychange', reconcileWhenVisible)
      window.clearInterval(intervalId)
    }
  }, [showPersistentSessionNotice, showSessionNotice, user?.restaurantId, user?.roleId, user?.userId])

  useEffect(() => {
    if (!user || !getAccessToken()) {
      return
    }

    let logoutTimerId: number | undefined
    const connection = createUserSessionEventsConnection({
      onUserDeactivated: (message) => {
        showPersistentSessionNotice({
          title: 'Giriş dayandırıldı',
          message: message || SESSION_TERMINATED_MESSAGE,
        }, false)

        window.clearTimeout(logoutTimerId)
        logoutTimerId = window.setTimeout(() => {
          clearAuthTokens()
          setUser(null)
          window.location.assign('/')
        }, 2500)
      },
      onUserRoleChanged: async (message) => {
        const notice = {
          title: 'Rol yeniləndi',
          message: message || ROLE_CHANGED_MESSAGE,
        }

        showPersistentSessionNotice(notice, 2000)

        window.clearTimeout(logoutTimerId)
        const refreshedTokens = await refreshAccessToken()
        const refreshedUser = refreshedTokens ? getUserFromToken(refreshedTokens.accessToken) : null

        if (!refreshedUser) {
          showSessionNotice({
            title: 'Sessiya yenilənmədi',
            message: 'Rolunuz dəyişdirildi, amma sessiya avtomatik yenilənmədi. Zəhmət olmasa yenidən daxil olun.',
          }, false)

          logoutTimerId = window.setTimeout(() => {
            clearAuthTokens()
            setUser(null)
            window.location.assign('/')
          }, 2500)
          return
        }

        setUser(withSelectedProfile(refreshedUser))
        logoutTimerId = window.setTimeout(() => {
          window.sessionStorage.setItem(SESSION_NOTICE_STORAGE_KEY, JSON.stringify(notice))
          navigate(getHomePathForUser(refreshedUser), { replace: true })
        }, 1200)
      },
      onRestaurantAccessChanged: (payload) => {
        showPersistentSessionNotice({
          title: 'Restoran icazələri yeniləndi',
          message: payload.message || RESTAURANT_ACCESS_CHANGED_MESSAGE,
        }, 2000)

        window.setTimeout(() => {
          window.location.reload()
        }, 1800)
      },
      onConnectionRestored: async () => {
        const refreshedTokens = await refreshAccessToken({ notifyOnFailure: false })
        const refreshedUser = refreshedTokens ? getUserFromToken(refreshedTokens.accessToken) : null

        if (refreshedUser) {
          setUser(withSelectedProfile(refreshedUser))
        }
      },
    })

    void connection.start().catch((error) => {
      if (import.meta.env.DEV) {
        console.error('Realtime session connection failed.', error)
      }
    })

    return () => {
      window.clearTimeout(logoutTimerId)
      void connection.stop()
    }
  }, [navigate, showPersistentSessionNotice, showSessionNotice, user?.userId])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthReady,
      isAuthenticated: user !== null,
      setSession: (tokens) => {
        saveAuthTokens(tokens)
        const nextUser = withSelectedProfile(getUserFromToken(tokens.accessToken))
        profilePromptUserIdRef.current = ''
        setUser(nextUser)
        setIsAuthReady(true)
      },
      updateUser: (patch) => {
        setUser((currentUser) => (currentUser ? { ...currentUser, ...patch } : currentUser))
      },
      selectProfile: (profile) => {
        setUser((currentUser) => {
          const nextUser = withSelectedProfile(currentUser, profile)
          if (nextUser) {
            writeStoredProfileKey(nextUser.userId, profile)
          }

          return nextUser
        })
        setIsProfilePromptOpen(false)
      },
      selectProfileForRestaurant: (restaurantId) => {
        setUser((currentUser) => {
          if (!currentUser) {
            return currentUser
          }

          const profile = currentUser.profiles.find((item) => item.restaurantId === restaurantId)
          if (!profile) {
            return currentUser
          }

          writeStoredProfileKey(currentUser.userId, profile)
          return withSelectedProfile(currentUser, profile)
        })
        setIsProfilePromptOpen(false)
      },
      logout: async () => {
        markManualLogout()
        try {
          await ecafeApi.auth.logout()
        } finally {
          clearAuthTokens()
          setUser(null)
          setIsProfilePromptOpen(false)
          setIsAuthReady(true)
        }
      },
      logoutAll: async () => {
        markManualLogout()
        try {
          await ecafeApi.auth.logoutAll()
        } finally {
          clearAuthTokens()
          setUser(null)
          setIsProfilePromptOpen(false)
          setIsAuthReady(true)
        }
      },
    }),
    [isAuthReady, user],
  )

  useEffect(() => {
    if (!user || !getAccessToken()) {
      profilePromptUserIdRef.current = ''
      setIsProfilePromptOpen(false)
      return
    }

    let isCurrent = true
    const authenticatedUser = user

    async function prepareProfileSelection() {
      let currentUser: CurrentUser = authenticatedUser

      try {
        const profile = await ecafeApi.profile.get()
        if (isCurrent && profile) {
          setUser((storedUser) => {
            if (!storedUser) {
              return storedUser
            }

            const nextUser = mergeProfileDetails(storedUser, profile)
            currentUser = nextUser
            return profileSignature(nextUser.profiles) === profileSignature(storedUser.profiles) &&
              nextUser.restaurantId === storedUser.restaurantId &&
              nextUser.roleId === storedUser.roleId
              ? storedUser
              : nextUser
          })
        }
      } catch {
        // Profile selection can still fall back to JWT claims when profile refresh is unavailable.
      }

      if (!isCurrent || profilePromptUserIdRef.current === currentUser.userId) {
        return
      }

      profilePromptUserIdRef.current = currentUser.userId

      if (currentUser.profiles.length <= 1 || hasStoredProfile(currentUser)) {
        setIsProfilePromptOpen(false)
        return
      }

      setIsProfilePromptOpen(true)
    }

    void prepareProfileSelection()

    return () => {
      isCurrent = false
    }
  }, [user?.userId])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user && isProfilePromptOpen ? (
        <ProfileSelectionPrompt
          profiles={user.profiles}
          userName={`${user.name} ${user.surname}`.trim()}
          onSelect={(profile) => {
            value.selectProfile(profile)
            navigate(getHomePathForUser(withSelectedProfile(user, profile) || user), { replace: true })
          }}
        />
      ) : null}
      {sessionNotice ? (
        <div className="session-termination-notice" role="alert">
          <strong>{sessionNotice.title}</strong>
          <span>{sessionNotice.message}</span>
        </div>
      ) : null}
    </AuthContext.Provider>
  )
}

function ProfileSelectionPrompt({
  onSelect,
  profiles,
  userName,
}: {
  onSelect: (profile: UserAccessProfile) => void
  profiles: UserAccessProfile[]
  userName: string
}) {
  return (
    <div className="modal-backdrop profile-selection-backdrop" role="presentation">
      <section aria-labelledby="profile-selection-title" className="profile-selection-modal" role="dialog" aria-modal="true">
        <div className="section-title">
          <span>Giriş profili</span>
          <h2 id="profile-selection-title">Hansı profillə davam edirsiniz?</h2>
        </div>
        <p className="muted-text">
          {userName ? `${userName}, ` : ''}seçdiyiniz rol və restorana uyğun menyular açılacaq.
        </p>
        <div className="profile-selection-list">
          {profiles.map((profile) => (
            <button key={profileKey(profile)} onClick={() => onSelect(profile)} type="button">
              <span className="profile-selection-icon" aria-hidden="true">
                {(profile.restaurantName || `R${profile.restaurantId}`).slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{profile.restaurantName || `Restoran #${profile.restaurantId}`}</strong>
                <small>{profile.roleName || roleNamesById[profile.roleId] || `Rol #${profile.roleId}`}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
