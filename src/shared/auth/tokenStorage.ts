import { deleteCookie } from './cookieStorage'

export const ACCESS_TOKEN_COOKIE = 'ecafe_access_token'
export const REFRESH_TOKEN_COOKIE = 'ecafe_refresh_token'
const LEGACY_TOKEN_COOKIE = 'token'
const ACCESS_TOKEN_STORAGE_KEY = 'ecafe.accessToken'
const REFRESH_TOKEN_STORAGE_KEY = 'ecafe.refreshToken'

// SPA fallback: backend still returns tokens in body, so keep them tab-scoped and clear old JS cookies.
let accessTokenInMemory = getSessionValue(ACCESS_TOKEN_STORAGE_KEY)

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export function getAccessToken() {
  return accessTokenInMemory
}

export function getRefreshToken() {
  return getSessionValue(REFRESH_TOKEN_STORAGE_KEY)
}

export function saveAuthTokens(tokens: AuthTokens) {
  clearLegacyAuthCookies()
  accessTokenInMemory = tokens.accessToken
  setSessionValue(ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken)

  if (tokens.refreshToken) {
    setSessionValue(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken)
  }
}

export function clearAuthTokens() {
  accessTokenInMemory = ''
  clearLegacyAuthCookies()
  removeSessionValue(ACCESS_TOKEN_STORAGE_KEY)
  removeSessionValue(REFRESH_TOKEN_STORAGE_KEY)
}

function clearLegacyAuthCookies() {
  deleteCookie(LEGACY_TOKEN_COOKIE)
  deleteCookie(ACCESS_TOKEN_COOKIE)
  deleteCookie(REFRESH_TOKEN_COOKIE)
}

function getSessionValue(key: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.sessionStorage.getItem(key) ?? ''
}

function setSessionValue(key: string, value: string) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(key, value)
  }
}

function removeSessionValue(key: string) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(key)
  }
}
