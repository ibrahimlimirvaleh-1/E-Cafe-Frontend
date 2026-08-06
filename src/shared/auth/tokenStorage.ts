import { deleteCookie, getCookie, setCookie } from './cookieStorage'

export const ACCESS_TOKEN_COOKIE = 'ecafe_access_token'
export const REFRESH_TOKEN_COOKIE = 'ecafe_refresh_token'
export const AUTH_TOKENS_CHANGED_EVENT = 'ecafe-auth-tokens-changed'

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
  setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken)
  setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken)
  notifyAuthTokensChanged()
}

export function clearAuthTokens() {
  deleteCookie(ACCESS_TOKEN_COOKIE)
  deleteCookie(REFRESH_TOKEN_COOKIE)
  notifyAuthTokensChanged()
}

export function onAuthTokensChanged(listener: () => void) {
  window.addEventListener(AUTH_TOKENS_CHANGED_EVENT, listener)
  return () => window.removeEventListener(AUTH_TOKENS_CHANGED_EVENT, listener)
}

function notifyAuthTokensChanged() {
  window.dispatchEvent(new Event(AUTH_TOKENS_CHANGED_EVENT))
}
