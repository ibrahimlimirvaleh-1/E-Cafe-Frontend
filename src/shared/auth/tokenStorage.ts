import { deleteCookie } from './cookieStorage'

export const ACCESS_TOKEN_COOKIE = 'ecafe_access_token'
export const REFRESH_TOKEN_COOKIE = 'ecafe_refresh_token'
const LEGACY_TOKEN_COOKIE = 'token'
const ACCESS_TOKEN_STORAGE_KEY = 'ecafe.accessToken'
const REFRESH_TOKEN_STORAGE_KEY = 'ecafe.refreshToken'

let accessTokenInMemory = ''

export type AuthTokens = {
  accessToken: string
  refreshToken?: string
}

export function getAccessToken() {
  return accessTokenInMemory
}

export function saveAuthTokens(tokens: AuthTokens) {
  clearLegacyAuthState()
  accessTokenInMemory = tokens.accessToken
}

export function clearAuthTokens() {
  accessTokenInMemory = ''
  clearLegacyAuthState()
}

function clearLegacyAuthState() {
  clearLegacyAuthCookies()
  removeSessionValue(ACCESS_TOKEN_STORAGE_KEY)
  removeSessionValue(REFRESH_TOKEN_STORAGE_KEY)
}

function clearLegacyAuthCookies() {
  deleteCookie(LEGACY_TOKEN_COOKIE)
  deleteCookie(ACCESS_TOKEN_COOKIE)
  deleteCookie(REFRESH_TOKEN_COOKIE)
}

function removeSessionValue(key: string) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(key)
  }
}
