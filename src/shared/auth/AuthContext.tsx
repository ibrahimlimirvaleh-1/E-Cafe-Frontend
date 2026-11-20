import { i18n } from '../i18n/i18n'
import { HubConnectionState } from '@microsoft/signalr'
import { roleLabel } from '../i18n/roleLabel'
import { useTranslation } from 'react-i18next'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getUserFromToken } from './jwt'
import type { CurrentUser, UserAccessProfile } from './jwt'
import { clearAuthTokens, getAccessToken, hasManualLogoutMarker, markManualLogout, saveAuthTokens } from './tokenStorage'
import type { AuthTokens } from './tokenStorage'
import { ecafeApi } from '../api/ecafeApi'
import { refreshAccessToken } from '../api/httpClient'
import { createUserSessionEventsConnection, type RealtimeConnectionStatus } from '../realtime/userSessionEvents'
import { dispatchOrderSync } from '../realtime/orderEvents'
import { getHomePathForUser } from './authz'
import { clearVerifiedProfiles, profileKey, readStoredProfileKey, syncVerifiedProfiles } from './activeProfileStorage'
import { assignmentSignature, mergeProfileDetails, profileScope, profileSignature, sameAccessState, withSelectedProfile } from './accessProfiles'
import { Button } from '../ui/Button'
import './profile-access.css'

const SESSION_TERMINATED_MESSAGE = 'Hesabınız deaktiv edilib. Sistemə girişiniz dayandırıldı.'
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
  tone?: 'info'
}

type AuthContextValue = {
  user: CurrentUser | null
  realtimeStatus: RealtimeConnectionStatus
  isAuthReady: boolean
  isAuthenticated: boolean
  setSession: (tokens: AuthTokens) => void
  updateUser: (patch: Partial<CurrentUser>) => void
  selectProfile: (profile: Pick<UserAccessProfile, 'restaurantId' | 'roleId'>) => void
  selectProfileForRestaurant: (restaurantId: string) => void
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  clearSession: () => void
  scopeRevision: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function hasStoredProfile(user: CurrentUser) {
  const storedProfileKey = readStoredProfileKey(user.userId)
  return Boolean(storedProfileKey && user.profiles.some((profile) => profileKey(profile) === storedProfileKey))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const location = useLocation()
  const locationKeyRef = useRef(location.key)
  locationKeyRef.current = location.key
  const selectionIntentRef = useRef<string | null>(null)
  const didBootstrapSessionRef = useRef(false)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  const profilePromptUserIdRef = useRef('')
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>('connecting')
  const [isProfilePromptOpen, setIsProfilePromptOpen] = useState(false)
  const [user, setUserState] = useState<CurrentUser | null>(() => {
    const token = getAccessToken()
    return token ? withSelectedProfile(getUserFromToken(token)) : null
  })
  const [isAuthReady, setIsAuthReady] = useState(() => Boolean(getAccessToken()))
  const [restoreRetry, setRestoreRetry] = useState(0)
  const [restoreError, setRestoreError] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const userRef = useRef(user)
  const sessionEpochRef = useRef(0)
  const reconcileIdRef = useRef(0)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const [scopeRevision, setScopeRevision] = useState(0)
  const setUser = useCallback((update: CurrentUser | null | ((current: CurrentUser | null) => CurrentUser | null)) => {
    const next = typeof update === 'function' ? update(userRef.current) : update
    userRef.current = next
    setUserState(next)
  }, [])
  const invalidateSessionWork = useCallback(() => {
    clearVerifiedProfiles()
    selectionIntentRef.current = null
    reconcileIdRef.current += 1
    sessionEpochRef.current += 1
    setSessionEpoch(sessionEpochRef.current)
  }, [])

  const showSessionNotice = useCallback((notice: SessionNotice, autoHideMs: number | false = 2000) => {
    window.clearTimeout(noticeTimerRef.current)
    setSessionNotice(notice)

    if (autoHideMs !== false) {
      noticeTimerRef.current = window.setTimeout(() => {
        setSessionNotice(null)
      }, autoHideMs)
    }
  }, [])

  const terminateSession = useCallback((message = SESSION_TERMINATED_MESSAGE) => {
    invalidateSessionWork()
    markManualLogout()
    clearAuthTokens()
    setUser(null)
    setRestoreError('')
    setIsAuthReady(true)
    setIsProfilePromptOpen(false)
    showSessionNotice({ title: i18n.t('ui.profiles.sessionEnded'), message }, false)
    navigateRef.current('/login', { replace: true })
  }, [invalidateSessionWork, setUser, showSessionNotice])

  const reconcileProfiles = useCallback(async ({ refresh = false, reason, restaurantId, resetScope = false }: { refresh?: boolean; reason?: string; restaurantId?: number; resetScope?: boolean } = {}) => {
    const owner = userRef.current
    if (!owner || !getAccessToken()) return
    const epoch = sessionEpochRef.current
    const requestId = ++reconcileIdRef.current
    const hadStoredProfile = hasStoredProfile(owner)
    let didResetScope = false
    const isCurrent = () => requestId === reconcileIdRef.current && epoch === sessionEpochRef.current && userRef.current?.userId === owner.userId && Boolean(getAccessToken())
    try {
      const details = await ecafeApi.profile.get()
      if (!isCurrent() || !details) return
      if (!details.isActive) { terminateSession(); return }
      const apply = (base: CurrentUser) => {
        const current = userRef.current!
        const next = mergeProfileDetails(base, details, current)
        syncVerifiedProfiles(next)
        const changedScope = profileScope(next) !== profileScope(current)
        const changedProfiles = profileSignature(next.profiles) !== profileSignature(current.profiles)
        setUser(sameAccessState(current, next) ? current : next)
        if (changedScope) {
          setIsProfilePromptOpen(false)
          showSessionNotice({ tone: 'info', title: i18n.t('ui.profiles.accessUpdated'), message: i18n.t(next.profiles.length ? 'ui.profiles.switched' : 'ui.profiles.personal') }, 5000)
          navigateRef.current(getHomePathForUser(next), { replace: true })
        } else if (changedProfiles && (reason === 'staff_activated' || reason === 'staff_deactivated')) {
          showSessionNotice({ tone: 'info', title: i18n.t('ui.profiles.accessUpdated'), message: i18n.t(reason === 'staff_activated' ? 'ui.profiles.activated' : 'ui.profiles.deactivated') }, 5000)
        }
        if (!changedScope && !didResetScope && resetScope && (restaurantId === undefined || String(restaurantId) === current.restaurantId || current.roleId === '1')) {
          didResetScope = true
          setScopeRevision(value => value + 1)
        }
      }
      const tokenUser = getUserFromToken(getAccessToken())
      apply(userRef.current!)
      const current = userRef.current!
      if (profilePromptUserIdRef.current !== owner.userId) {
        profilePromptUserIdRef.current = owner.userId
        setIsProfilePromptOpen(current.profiles.length > 1 && !hadStoredProfile)
      }
      if (!refresh && assignmentSignature(current.restaurantRoles) === assignmentSignature(tokenUser?.restaurantRoles || []) && (current.profiles.length > 0 || current.roleId === tokenUser?.roleId)) return
      const tokens = await refreshAccessToken({ notifyOnFailure: false })
      if (!isCurrent()) return
      const refreshed = tokens ? getUserFromToken(tokens.accessToken) : null
      if (refreshed?.userId === owner.userId) apply(refreshed)
    } catch {
      // Retain the current safe scope on transient failure; focus/reconnect/poll retries.
    }
  }, [setUser, showSessionNotice, terminateSession])

  const selectAccessProfile = useCallback((profile: Pick<UserAccessProfile, 'restaurantId' | 'roleId'>) => {
    const current = userRef.current
    if (!current || !current.profiles.some(item => profileKey(item) === profileKey(profile))) return
    const next = withSelectedProfile(current, profile)!
    setIsProfilePromptOpen(false)
    if (profileScope(current) === profileScope(next)) return
    reconcileIdRef.current += 1
    syncVerifiedProfiles(next)
    setUser(next)
    void reconcileProfiles()
  }, [reconcileProfiles, setUser])

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
      setRestoreError('')
      setIsAuthReady(true)
      return
    }

    didBootstrapSessionRef.current = true
    const epoch = sessionEpochRef.current
    let isCurrent = true
    setIsRestoring(true)

    async function restoreSessionFromCookie() {
      try {
        const tokens = await refreshAccessToken({ notifyOnFailure: false })
        const restoredUser = tokens ? getUserFromToken(tokens.accessToken) : null

        if (isCurrent && epoch === sessionEpochRef.current) {
          if (restoredUser) setUser(withSelectedProfile(restoredUser))
          setRestoreError('')
          setIsAuthReady(true)
        }
      } catch {
        if (isCurrent && epoch === sessionEpochRef.current) {
          setRestoreError('Sessiyanı yoxlamaq mümkün olmadı. Bağlantını yoxlayıb yenidən cəhd edin.')
          setIsAuthReady(false)
        }
      } finally {
        if (isCurrent && epoch === sessionEpochRef.current) setIsRestoring(false)
      }
    }

    void restoreSessionFromCookie()

    return () => {
      isCurrent = false
      didBootstrapSessionRef.current = false
    }
  }, [user, restoreRetry])

  useEffect(() => {
    function handleAuthExpired(event: Event) {
      if (hasManualLogoutMarker()) return
      const message = event instanceof CustomEvent && typeof event.detail?.message === 'string'
        ? event.detail.message : SESSION_TERMINATED_MESSAGE
      terminateSession(message)
    }
    window.addEventListener('ecafe:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('ecafe:auth-expired', handleAuthExpired)
  }, [terminateSession])

  useEffect(() => {
    if (!user?.userId || !getAccessToken()) return
    const reconcileWhenVisible = () => {
      if (document.visibilityState === 'visible') void reconcileProfiles()
    }
    void reconcileProfiles()
    window.addEventListener('focus', reconcileWhenVisible)
    document.addEventListener('visibilitychange', reconcileWhenVisible)
    const timer = window.setInterval(() => { void reconcileProfiles() }, SESSION_RECONCILE_INTERVAL_MS)
    return () => {
      window.removeEventListener('focus', reconcileWhenVisible)
      document.removeEventListener('visibilitychange', reconcileWhenVisible)
      window.clearInterval(timer)
    }
  }, [reconcileProfiles, user?.userId, sessionEpoch])

  useEffect(() => {
    if (!user || !getAccessToken()) {
      setRealtimeStatus('connecting')
      return
    }

    let disposed = false
    const ownerId = user.userId
    const epoch = sessionEpochRef.current
    const isCurrentConnection = () => !disposed && epoch === sessionEpochRef.current && userRef.current?.userId === ownerId && Boolean(getAccessToken())
    let retryId: number | undefined
    let starting = false
    setRealtimeStatus('connecting')
    const connection = createUserSessionEventsConnection({
      onConnectionStatusChange: (status) => {
        if (!isCurrentConnection()) return
        setRealtimeStatus(status)
        if (status === 'offline') scheduleRetry()
      },
      onUserDeactivated: (message) => {
        if (isCurrentConnection()) terminateSession(message)
      },
      onUserRoleChanged: () => {
        if (isCurrentConnection()) void reconcileProfiles({ refresh: true, resetScope: true })
      },
      onRestaurantAccessChanged: (payload) => {
        if (isCurrentConnection()) void reconcileProfiles({ refresh: true, reason: payload.reason, restaurantId: payload.restaurantId, resetScope: payload.reason !== 'staff_activated' && payload.reason !== 'staff_deactivated' })
      },
      onNotificationsChanged: () => {
        if (isCurrentConnection()) window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      },
      onConnectionRestored: () => {
        if (!isCurrentConnection()) return
        dispatchOrderSync()
        void reconcileProfiles({ refresh: true })
      },
    })

    function scheduleRetry() {
      if (disposed || retryId !== undefined) return
      retryId = window.setTimeout(() => {
        retryId = undefined
        void startConnection()
      }, 10000)
    }

    async function startConnection() {
      if (disposed || starting || !navigator.onLine) {
        if (!disposed && !navigator.onLine) setRealtimeStatus('offline')
        return
      }
      if (connection.state !== HubConnectionState.Disconnected) return
      starting = true
      try {
        await connection.start()
        if (isCurrentConnection()) {
          setRealtimeStatus('connected')
          dispatchOrderSync()
          window.dispatchEvent(new Event('ecafe:notifications-refresh'))
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Realtime session connection failed.', error)
        }
        if (isCurrentConnection()) {
          setRealtimeStatus('offline')
          scheduleRetry()
        }
      } finally {
        starting = false
      }
    }

    function onOnline() {
      if (!isCurrentConnection()) return
      window.clearTimeout(retryId)
      retryId = undefined
      dispatchOrderSync()
      window.dispatchEvent(new Event('ecafe:notifications-refresh'))
      void startConnection()
      void reconcileProfiles({ refresh: true })
    }
    function onVisible() {
      if (isCurrentConnection() && document.visibilityState === 'visible') dispatchOrderSync()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    void startConnection()

    return () => {
      disposed = true
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearTimeout(retryId)
      void connection.stop()
    }
  }, [reconcileProfiles, terminateSession, user?.userId, sessionEpoch])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      realtimeStatus,
      isAuthReady,
      isAuthenticated: user !== null,
      scopeRevision: `${sessionEpoch}:${scopeRevision}`,
      clearSession: () => {
        invalidateSessionWork()
        markManualLogout()
        clearAuthTokens()
        setUser(null)
        setSessionNotice(null)
        setRestoreError('')
        setIsProfilePromptOpen(false)
        setIsAuthReady(true)
      },
      setSession: (tokens) => {
        invalidateSessionWork()
        saveAuthTokens(tokens)
        const nextUser = withSelectedProfile(getUserFromToken(tokens.accessToken))
        profilePromptUserIdRef.current = ''
        setUser(nextUser)
        setRestoreError('')
        setIsAuthReady(true)
        setSessionNotice(null)
      },
      updateUser: (patch) => {
        setUser((currentUser) => (currentUser ? { ...currentUser, ...patch } : currentUser))
      },
      selectProfile: (profile) => {
        selectionIntentRef.current = locationKeyRef.current
        selectAccessProfile(profile)
      },
      selectProfileForRestaurant: (restaurantId) => {
        // An old route's effect must not undo the user's explicit profile switch.
        if (selectionIntentRef.current === locationKeyRef.current) return
        const profile = userRef.current?.profiles.find(item => item.restaurantId === restaurantId)
        if (profile) selectAccessProfile(profile)
      },
      logout: async () => {
        const epoch = sessionEpochRef.current
        markManualLogout()
        try {
          await ecafeApi.auth.logout()
        } finally {
          if (epoch === sessionEpochRef.current) {
            invalidateSessionWork()
            clearAuthTokens()
            setUser(null)
            setIsProfilePromptOpen(false)
            setIsAuthReady(true)
          }
        }
      },
      logoutAll: async () => {
        const epoch = sessionEpochRef.current
        markManualLogout()
        try {
          await ecafeApi.auth.logoutAll()
        } finally {
          if (epoch === sessionEpochRef.current) {
            invalidateSessionWork()
            clearAuthTokens()
            setUser(null)
            setIsProfilePromptOpen(false)
            setIsAuthReady(true)
          }
        }
      },
    }),
    [invalidateSessionWork, isAuthReady, realtimeStatus, scopeRevision, sessionEpoch, selectAccessProfile, setUser, user],
  )


  return (
    <AuthContext.Provider value={value}>
      {restoreError && !user ? (
        <main className="auth-page">
          <section className="auth-card" role="alert">
            <h1>{i18n.t('ui.shared.auth.auth_context.baglanti_problemi_3b4e1f')}</h1>
            <p>{restoreError}</p>
            <Button disabled={isRestoring} onClick={() => setRestoreRetry((value) => value + 1)} type="button">
              {isRestoring ?i18n.t('ui.shared.auth.auth_context.yoxlanilir_b497d3') :i18n.t('ui.shared.auth.auth_context.yeniden_yoxla_9c69a3')}
            </Button>
          </section>
        </main>
      ) : children}
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
        <div className={`session-termination-notice${sessionNotice.tone === 'info' ? ' session-profile-notice' : ''}`} role={sessionNotice.tone === 'info' ? 'status' : 'alert'}>
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
  useTranslation()
  return (
    <div className="modal-backdrop profile-selection-backdrop" role="presentation">
      <section aria-labelledby="profile-selection-title" className="profile-selection-modal" role="dialog" aria-modal="true">
        <div className="section-title">
          <span>{i18n.t('ui.shared.auth.auth_context.giris_profili_f77b32')}</span>
          <h2 id="profile-selection-title">{i18n.t('ui.shared.auth.auth_context.hansi_profille_davam_edirsiniz_75da03')}</h2>
        </div>
        <p className="muted-text">
          {userName ? `${userName}, ` : ''}{i18n.t('ui.shared.auth.auth_context.secdiyiniz_rol_ve_restorana_uygun_meny_2eedf3')}
        </p>
        <div className="profile-selection-list">
          {profiles.map((profile) => (
            <button key={profileKey(profile)} onClick={() => onSelect(profile)} type="button">
              <span className="profile-selection-icon" aria-hidden="true">
                {(profile.restaurantName || `R${profile.restaurantId}`).slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{profile.restaurantName || `Restoran #${profile.restaurantId}`}</strong>
                <small>{roleLabel(profile.roleId, profile.roleName || roleNamesById[profile.roleId])}</small>
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
