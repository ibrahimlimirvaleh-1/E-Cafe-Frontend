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

type SessionNotice = {
  title: string
  message: string
}

type AuthContextValue = {
  user: CurrentUser | null
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

  const showSessionNotice = useCallback((notice: SessionNotice, autoHideMs: number | false = 2000) => {
    window.clearTimeout(noticeTimerRef.current)
    setSessionNotice(notice)

    if (autoHideMs !== false) {
      noticeTimerRef.current = window.setTimeout(() => {
        setSessionNotice(null)
      }, autoHideMs)
    }
  }, [])

  useEffect(() => {
    return () => window.clearTimeout(noticeTimerRef.current)
  }, [])

  useEffect(() => {
    if (didBootstrapSessionRef.current || user || getAccessToken()) {
      return
    }

    didBootstrapSessionRef.current = true
    let isCurrent = true

    async function restoreSessionFromCookie() {
      const tokens = await refreshAccessToken({ notifyOnFailure: false })
      const restoredUser = tokens ? getUserFromToken(tokens.accessToken) : null

      if (isCurrent && restoredUser) {
        setUser(restoredUser)
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

    async function validateStoredSession() {
      const profile = await ecafeApi.profile.get()

      if (!isCurrent || !getAccessToken()) {
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
      }
    }

    void validateStoredSession()

    return () => {
      isCurrent = false
    }
  }, [showSessionNotice, user?.userId])

  useEffect(() => {
    if (!user || !getAccessToken()) {
      return
    }

    let logoutTimerId: number | undefined
    const connection = createUserSessionEventsConnection({
      onUserDeactivated: (message) => {
        showSessionNotice({
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
        showSessionNotice({
          title: 'Rol yeniləndi',
          message: message || ROLE_CHANGED_MESSAGE,
        }, 2000)

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
          navigate(getHomePathForUser(refreshedUser), { replace: true })
        }, 1200)
      },
      onRestaurantAccessChanged: (payload) => {
        showSessionNotice({
          title: 'Restoran icazələri yeniləndi',
          message: payload.message || RESTAURANT_ACCESS_CHANGED_MESSAGE,
        }, 2000)

        window.setTimeout(() => {
          window.location.reload()
        }, 1800)
      },
    })

    void connection.start().catch(() => {
      // Realtime logout is a user-experience layer; token revocation still protects API access.
    })

    return () => {
      window.clearTimeout(logoutTimerId)
      void connection.stop()
    }
  }, [navigate, showSessionNotice, user?.userId])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      setSession: (tokens) => {
        saveAuthTokens(tokens)
        setUser(getUserFromToken(tokens.accessToken))
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
        }
      },
    }),
    [user],
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
