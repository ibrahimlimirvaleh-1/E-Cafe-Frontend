import { useEffect, useState } from 'react'

type PasswordPath = '/reset-password' | '/set-password'
type CapturedLink = { path: PasswordPath; token: string }

function capture(): CapturedLink | null {
  if (typeof window === 'undefined') return null
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase()
  if (path !== '/reset-password' && path !== '/set-password') return null
  const url = new URL(window.location.href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  if (!fragment.has('token') && !url.searchParams.has('token')) return null
  const tokens = (fragment.has('token') ? fragment : url.searchParams).getAll('token')
  const token = tokens.length === 1 && tokens[0].length <= 4096 && !/\s/.test(tokens[0]) ? tokens[0] : ''
  fragment.delete('token')
  url.searchParams.delete('token')
  url.hash = fragment.toString()
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  return { path, token }
}

// Bootstrap import runs before the router/auth/localization see the URL. Keep a copy for StrictMode's double initializer.
let captured = capture()

export function usePasswordLinkToken(path: PasswordPath) {
  const [token] = useState(() => {
    captured = capture() || captured
    return captured?.path === path ? captured.token : ''
  })
  useEffect(() => { captured = null }, [])
  return token
}
