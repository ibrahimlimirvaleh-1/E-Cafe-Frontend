import { deleteCookie, getCookie, setCookie } from './cookieStorage'

export const ACCESS_TOKEN_COOKIE = 'ecafe_access_token'
export const REFRESH_TOKEN_COOKIE = 'ecafe_refresh_token'
const LEGACY_TOKEN_COOKIE = 'token'

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export function getAccessToken() {
  return getCookie(ACCESS_TOKEN_COOKIE)
}

export function getRefreshToken() {
  return getCookie(REFRESH_TOKEN_COOKIE)
}

export function saveAuthTokens(tokens: AuthTokens) {
  clearLegacyAuthCookies()
  setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken)
  setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken)
}

export function clearAuthTokens() {
  clearLegacyAuthCookies()
  deleteCookie(ACCESS_TOKEN_COOKIE)
  deleteCookie(REFRESH_TOKEN_COOKIE)
}

function clearLegacyAuthCookies() {
  deleteCookie(LEGACY_TOKEN_COOKIE)
}
