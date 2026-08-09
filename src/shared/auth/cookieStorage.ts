const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function setCookie(name: string, value: string, maxAgeSeconds = COOKIE_MAX_AGE_SECONDS) {
  document.cookie = buildCookie(name, encodeURIComponent(value), `max-age=${maxAgeSeconds}`)
}

export function getCookie(name: string) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))

  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
}

export function deleteCookie(name: string) {
  for (const path of getCookieDeletionPaths()) {
    document.cookie = buildCookie(name, '', 'max-age=0', path)
    document.cookie = buildCookie(name, '', 'expires=Thu, 01 Jan 1970 00:00:00 GMT', path)
  }
}

function buildCookie(name: string, value: string, lifetime: string, path = '/') {
  const attributes = [`${name}=${value}`, `path=${path}`, lifetime, 'SameSite=Lax']

  if (window.location.protocol === 'https:') {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}

function getCookieDeletionPaths() {
  const paths = new Set(['/'])
  const segments = window.location.pathname.split('/').filter(Boolean)
  let currentPath = ''

  for (const segment of segments) {
    currentPath += `/${segment}`
    paths.add(currentPath)
  }

  return paths
}
