import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getUserFromToken } from './jwt'
import type { CurrentUser } from './jwt'
import { clearAuthTokens, getAccessToken, onAuthTokensChanged, saveAuthTokens } from './tokenStorage'
import type { AuthTokens } from './tokenStorage'

type AuthContextValue = {
  user: CurrentUser | null
  isAuthenticated: boolean
  setSession: (tokens: AuthTokens) => void
  updateUser: (patch: Partial<CurrentUser>) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const readCurrentUser = () => {
    const token = getAccessToken()
    return token ? getUserFromToken(token) : null
  }

  const [user, setUser] = useState<CurrentUser | null>(readCurrentUser)

  useEffect(() => onAuthTokensChanged(() => setUser(readCurrentUser())), [])

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
      logout: () => {
        clearAuthTokens()
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
