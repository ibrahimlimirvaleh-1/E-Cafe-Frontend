import assert from 'node:assert/strict'
import vm from 'node:vm'
import path from 'node:path'
import { buildSync } from 'esbuild'

const bundle = buildSync({
  stdin: {
    contents: `export { httpClient, fetchProtectedBlob, refreshAccessToken } from './src/shared/api/httpClient'; export { getAccessToken, getAuthRevision, saveAuthTokens, clearAuthTokens, markManualLogout, hasManualLogoutMarker } from './src/shared/auth/tokenStorage';`,
    resolveDir: path.resolve('.'), loader: 'ts',
  },
  bundle: true, write: false, format: 'iife', globalName: 'AuthRace', platform: 'browser',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: '/api/v1' }), 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function storage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }
}

function setup() {
  const window = new EventTarget()
  Object.assign(window, { location: { protocol: 'https:', pathname: '/confirm-email-change', origin: 'https://ecafe.test' }, localStorage: storage(), sessionStorage: storage() })
  const responses = []
  const requests = []
  let expired = 0
  window.addEventListener('ecafe:auth-expired', () => { expired += 1 })
  const context = vm.createContext({
    window, document: { cookie: '', documentElement: { lang: 'en' } }, console,
    Event, CustomEvent, Headers, Response, FormData, Blob, URL, URLSearchParams, atob, btoa, setTimeout, clearTimeout,
    fetch: (url, init) => {
      requests.push({ url, init })
      assert.ok(responses.length, `Unexpected request: ${url}`)
      return responses.shift().promise
    },
  })
  vm.runInContext(bundle, context)
  const api = context.AuthRace
  return {
    api, requests, expired: () => expired,
    queue() { const item = deferred(); responses.push(item); return item },
    freshLogin() {
      // The email confirmation callback's exact local clear, then a successful login.
      api.markManualLogout()
      api.clearAuthTokens()
      api.saveAuthTokens({ accessToken: 'fresh-login' })
      assert.equal(api.hasManualLogoutMarker(), false)
    },
  }
}

const response = (status, token = 'old-refresh') => new Response(status === 200 ? JSON.stringify({ data: { accessToken: token } }) : JSON.stringify({ message: 'expired' }), { status, headers: { 'Content-Type': 'application/json' } })
let cases = 0

for (const status of [200, 401, 403, 500]) {
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'old-login' })
  const pending = test.queue()
  const refreshing = test.api.refreshAccessToken()
  test.freshLogin()
  pending.resolve(response(status))
  assert.equal(await refreshing, null)
  assert.equal(test.api.getAccessToken(), 'fresh-login', `Stale ${status} cannot replace or clear login`)
  assert.equal(test.expired(), 0, `Stale ${status} cannot dispatch expiry`)
  cases += 1
}

{
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'old-login' })
  const pending = test.queue()
  const refreshing = test.api.refreshAccessToken()
  test.freshLogin()
  pending.reject(new Error('Delayed offline failure'))
  assert.equal(await refreshing, null)
  assert.equal(test.api.getAccessToken(), 'fresh-login')
  assert.equal(test.expired(), 0)
  cases += 1
}

{
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'old-login' })
  const pending = test.queue()
  const body = deferred()
  const parsing = deferred()
  const refreshing = test.api.refreshAccessToken()
  pending.resolve({ status: 200, ok: true, json() { parsing.resolve(); return body.promise } })
  await parsing.promise
  test.freshLogin()
  body.resolve({ data: { accessToken: 'old-refresh' } })
  assert.equal(await refreshing, null)
  assert.equal(test.api.getAccessToken(), 'fresh-login', 'Revision is rechecked after body parsing')
  assert.equal(test.expired(), 0)
  cases += 1
}

{
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'old-login' })
  const staleResponse = test.queue()
  const stale = test.api.refreshAccessToken()
  test.freshLogin()
  const currentResponse = test.queue()
  const current = test.api.refreshAccessToken()
  staleResponse.resolve(response(401))
  assert.equal(await stale, null)
  const joined = test.api.refreshAccessToken()
  assert.equal(test.requests.length, 2, 'New login gets a new refresh; stale finally cannot detach its pending request')
  currentResponse.resolve(response(200, 'fresh-refresh'))
  assert.equal((await current).accessToken, 'fresh-refresh')
  assert.equal((await joined).accessToken, 'fresh-refresh')
  assert.equal(test.api.getAccessToken(), 'fresh-refresh')
  assert.equal(test.expired(), 0)
  cases += 1
}

for (const blob of [false, true]) {
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'old-login' })
  const pending = test.queue()
  const request = blob ? test.api.fetchProtectedBlob('/protected-file') : test.api.httpClient('/protected')
  const rejected = assert.rejects(request, error => error.statusCode === 401)
  test.freshLogin()
  pending.resolve(response(401))
  await rejected
  assert.equal(test.requests.length, 1, 'A stale 401 never refreshes using the new login')
  assert.equal(test.api.getAccessToken(), 'fresh-login')
  assert.equal(test.expired(), 0)
  cases += 1
}

for (const blob of [false, true]) {
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'old-login' })
  const unauthorized = test.queue()
  const pending = test.queue()
  const request = blob ? test.api.fetchProtectedBlob('/protected-file') : test.api.httpClient('/protected')
  const rejected = assert.rejects(request, error => error.statusCode === 401)
  unauthorized.resolve(response(401))
  // Wait until the old API request is actually waiting for the refresh response.
  while (test.requests.length < 2) await new Promise(resolve => setImmediate(resolve))
  test.freshLogin()
  pending.resolve(response(200))
  await rejected
  assert.equal(test.api.getAccessToken(), 'fresh-login')
  assert.equal(test.expired(), 0, 'Stale API fallback does not dispatch expiry after its refresh was discarded')
  cases += 1
}

{
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'old-login' })
  const pending = test.queue()
  const refreshing = test.api.refreshAccessToken()
  test.api.markManualLogout()
  test.api.clearAuthTokens()
  pending.resolve(response(200))
  assert.equal(await refreshing, null)
  assert.equal(test.api.getAccessToken(), '')
  assert.equal(test.expired(), 0)
  cases += 1
}

{
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'current-login' })
  const pending = test.queue()
  const refreshing = test.api.refreshAccessToken()
  pending.resolve(response(401))
  assert.equal(await refreshing, null)
  assert.equal(test.api.getAccessToken(), '')
  assert.equal(test.expired(), 1, 'A genuinely expired current session still emits expiry')
  cases += 1
}

{
  const test = setup()
  const pending = test.queue()
  const first = test.api.refreshAccessToken()
  const second = test.api.refreshAccessToken()
  assert.equal(test.requests.length, 1, 'Initial cookie bootstrap remains deduplicated')
  pending.resolve(response(200, 'restored-session'))
  assert.equal((await first).accessToken, 'restored-session')
  assert.equal((await second).accessToken, 'restored-session')
  assert.equal(test.api.getAccessToken(), 'restored-session')
  assert.equal(test.expired(), 0)
  cases += 1
}

for (const blob of [false, true]) {
  const test = setup()
  test.api.saveAuthTokens({ accessToken: 'current-login' })
  const unauthorized = test.queue()
  const refresh = test.queue()
  const retried = test.queue()
  const request = blob ? test.api.fetchProtectedBlob('/protected-file') : test.api.httpClient('/protected')
  unauthorized.resolve(response(401))
  while (test.requests.length < 2) await new Promise(resolve => setImmediate(resolve))
  refresh.resolve(response(200, 'current-refresh'))
  while (test.requests.length < 3) await new Promise(resolve => setImmediate(resolve))
  assert.equal(test.requests[2].init.headers.get('Authorization'), 'Bearer current-refresh')
  retried.resolve(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))
  const result = await request
  assert.equal(blob ? result instanceof Blob : result.data.ok, true)
  assert.equal(test.api.getAccessToken(), 'current-refresh')
  assert.equal(test.expired(), 0, 'Valid automatic retry still works')
  cases += 1
}

console.log(`PASS ${cases} deterministic auth-race cases: delayed refresh -> clear -> fresh login; stale success/401/403/500/network/body, per-revision deduplication, JSON/blob 401 fallback and valid retry, valid bootstrap and expiry`)
