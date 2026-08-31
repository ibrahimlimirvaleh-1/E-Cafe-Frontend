import { deleteCookie } from './cookieStorage'

export const ACCESS_TOKEN_COOKIE = 'ecafe_access_token'
const LEGACY_TOKEN_COOKIE = 'token'
const ACCESS_TOKEN_STORAGE_KEY = 'ecafe.accessToken'
const REFRESH_TOKEN_STORAGE_KEY = 'ecafe.refreshToken'
const MANUAL_LOGOUT_STORAGE_KEY = 'ecafe.manualLogoutAt'

let accessTokenInMemory = ''

export type AuthTokens = {
  accessToken: string
  refreshToken?: string
}

export function getAccessToken() {
  return accessTokenInMemory
}

export function saveAuthTokens(tokens: AuthTokens) {
  clearManualLogoutMarker()
  clearLegacyAuthState()
  accessTokenInMemory = tokens.accessToken
}

export function clearAuthTokens() {
  accessTokenInMemory = ''
  clearLegacyAuthState()
}

export function markManualLogout() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MANUAL_LOGOUT_STORAGE_KEY, String(Date.now()))
  }
}

export function hasManualLogoutMarker() {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(MANUAL_LOGOUT_STORAGE_KEY))
}

export function clearManualLogoutMarker() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(MANUAL_LOGOUT_STORAGE_KEY)
  }
}

function clearLegacyAuthState() {
  clearLegacyAuthCookies()
  removeSessionValue(ACCESS_TOKEN_STORAGE_KEY)
  removeSessionValue(REFRESH_TOKEN_STORAGE_KEY)
}

function clearLegacyAuthCookies() {
  deleteCookie(LEGACY_TOKEN_COOKIE)
  deleteCookie(ACCESS_TOKEN_COOKIE)
}

function removeSessionValue(key: string) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(key)
  }
}
