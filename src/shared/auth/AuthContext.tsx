import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getUserFromToken } from './jwt'
import type { CurrentUser } from './jwt'
import { clearAuthTokens, getAccessToken, saveAuthTokens } from './tokenStorage'
import type { AuthTokens } from './tokenStorage'
import { ecafeApi } from '../api/ecafeApi'
import { createUserSessionEventsConnection } from '../realtime/userSessionEvents'

const SESSION_TERMINATED_MESSAGE = 'Hesabınız deaktiv edilib. Sistemə girişiniz dayandırıldı.'

type AuthContextValue = {
  user: CurrentUser | null
  isAuthenticated: boolean
  setSession: (tokens: AuthTokens) => void
  updateUser: (patch: Partial<CurrentUser>) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionNotice, setSessionNotice] = useState('')
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const token = getAccessToken()
    return token ? getUserFromToken(token) : null
  })

  useEffect(() => {
    function terminateSession(message = SESSION_TERMINATED_MESSAGE) {
      setSessionNotice(message)
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
  }, [])

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
        setSessionNotice(SESSION_TERMINATED_MESSAGE)
        clearAuthTokens()
        setUser(null)
        window.setTimeout(() => window.location.assign('/'), 1200)
      }
    }

    void validateStoredSession()

    return () => {
      isCurrent = false
    }
  }, [user?.userId])

  useEffect(() => {
    if (!user || !getAccessToken()) {
      return
    }

    let logoutTimerId: number | undefined
    const connection = createUserSessionEventsConnection({
      onUserDeactivated: (message) => {
        setSessionNotice(message || SESSION_TERMINATED_MESSAGE)

        window.clearTimeout(logoutTimerId)
        logoutTimerId = window.setTimeout(() => {
          clearAuthTokens()
          setUser(null)
          window.location.assign('/')
        }, 2500)
      },
    })

    void connection.start().catch(() => {
      // Realtime logout is a user-experience layer; token revocation still protects API access.
    })

    return () => {
      window.clearTimeout(logoutTimerId)
      void connection.stop()
    }
  }, [user?.userId])

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
          <strong>Giriş dayandırıldı</strong>
          <span>{sessionNotice}</span>
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
