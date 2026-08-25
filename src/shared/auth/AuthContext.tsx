import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserFromToken } from './jwt'
import type { CurrentUser } from './jwt'
import { clearAuthTokens, getAccessToken, saveAuthTokens } from './tokenStorage'
import type { AuthTokens } from './tokenStorage'
import { ecafeApi } from '../api/ecafeApi'
import { refreshAccessToken } from '../api/httpClient'
import { createUserSessionEventsConnection } from '../realtime/userSessionEvents'
import { getHomePathForUser } from './authz'

const SESSION_TERMINATED_MESSAGE = 'Hesabınız deaktiv edilib. Sistemə girişiniz dayandırıldı.'
const ROLE_CHANGED_MESSAGE = 'Rolunuz dəyişdirildi. Sessiya məlumatları yenilənir.'
const RESTAURANT_ACCESS_CHANGED_MESSAGE = 'Restoran üzrə icazələr yeniləndi. Səhifə yenilənir.'
const SESSION_NOTICE_STORAGE_KEY = 'ecafe.sessionNotice'
const SESSION_RECONCILE_INTERVAL_MS = 60_000

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
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const didBootstrapSessionRef = useRef(false)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const token = getAccessToken()
    return token ? getUserFromToken(token) : null
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

    didBootstrapSessionRef.current = true
    let isCurrent = true

    async function restoreSessionFromCookie() {
      try {
        const tokens = await refreshAccessToken({ notifyOnFailure: false })
        const restoredUser = tokens ? getUserFromToken(tokens.accessToken) : null

        if (isCurrent && restoredUser) {
          setUser(restoredUser)
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

      const profileRoleId = String(profile.roleId || '')
      const profileRestaurantId = profile.restaurantId || undefined
      const sessionChanged =
        (profileRoleId && profileRoleId !== currentUser.roleId) ||
        profileRestaurantId !== currentUser.restaurantId

      if (!sessionChanged) {
        return
      }

      const refreshedTokens = await refreshAccessToken({ notifyOnFailure: false })
      const refreshedUser = refreshedTokens ? getUserFromToken(refreshedTokens.accessToken) : null

      if (!isCurrent || !refreshedUser) {
        return
      }

      setUser(refreshedUser)

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

        setUser(refreshedUser)
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
          setUser(refreshedUser)
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
        setUser(getUserFromToken(tokens.accessToken))
        setIsAuthReady(true)
      },
      updateUser: (patch) => {
        setUser((currentUser) => (currentUser ? { ...currentUser, ...patch } : currentUser))
      },
      logout: async () => {
        try {
          await ecafeApi.auth.logout()
        } finally {
          clearAuthTokens()
          setUser(null)
          setIsAuthReady(true)
        }
      },
    }),
    [isAuthReady, user],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionNotice ? (
        <div className="session-termination-notice" role="alert">
          <strong>{sessionNotice.title}</strong>
          <span>{sessionNotice.message}</span>
        </div>
      ) : null}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
