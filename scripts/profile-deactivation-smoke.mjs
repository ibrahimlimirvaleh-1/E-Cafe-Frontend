import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://ecafe.test'
const dist = path.resolve('dist')
const profiles = [
  { restaurantId: 1, restaurantName: 'R1 Restaurant', roleId: 2, roleName: 'Owner', isActive: true },
  { restaurantId: 2, restaurantName: 'R2 Restaurant', roleId: 3, roleName: 'Manager', isActive: true },
]
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map(language => [language, JSON.parse(fs.readFileSync(`src/shared/i18n/catalog/${language}.json`, 'utf8'))]))
const handoff = JSON.parse(fs.readFileSync('docs/restaurant-profile-ui-messages.json', 'utf8'))
for (const language of ['az', 'en', 'ru']) assert.deepEqual(handoff[language], Object.fromEntries(Object.entries(catalogs[language]).filter(([key]) => key.startsWith('ui.profiles.'))))
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const errors = []
let cases = 0
const defer = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
const problem = (route, code, status) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message: '' }) })
const waitFor = async condition => { const until = Date.now() + 10000; while (!condition()) { assert.ok(Date.now() < until, 'Mock event did not arrive'); await new Promise(resolve => setTimeout(resolve, 10)) } }

function backend() { return { profiles: [...profiles], accountActive: true, expired: false, blockedTarget: false, targetActive: true, contracts: { 1: true, 2: true }, sessionVersion: 0, denialStatus: 401, legacyProfileResponse: false } }
function account(server, id = '42') {
  const assignments = ['1', '5'].includes(id) ? [] : id === '84' ? [profiles[1]] : server.profiles
  return { userId: id, name: id === '84' ? 'Fresh' : 'Shared', surname: id === '1' ? 'Admin' : 'Person', email: `user${id}@example.com`, phone: '+994501234567', roleId: id === '1' ? 1 : id === '5' ? 5 : assignments[0]?.roleId || 2, isActive: server.accountActive, profiles: assignments.map(item => ({ ...item })) }
}
function jwt(server, id = '42') {
  const user = account(server, id)
  return `header.${Buffer.from(JSON.stringify({ ...user, sessionVersion: server.sessionVersion, roleId: String(user.roleId), restaurantId: user.profiles[0]?.restaurantId, restaurantRoles: user.profiles.map(item => `${item.restaurantId}:${item.roleId}`), restaurantIds: user.profiles.map(item => String(item.restaurantId)), permissions: user.profiles.length ? ['ManageStaff', 'ManageOrders'] : [] })).toString('base64url')}.signature`
}
function requestUser(request) {
  try { return String(JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url').toString()).userId) } catch { return '42' }
}
const missingStaff = (server, id) => !['1', '5'].includes(id) && account(server, id).profiles.length === 0

async function setup(server, { selected = 1, language = 'en', actor = '42', width = 1440, legacyCustomerToken = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ language, selected, actor }) => {
    localStorage.setItem('ecafe.language', language)
    if (actor !== '1') localStorage.setItem(`ecafe.activeProfile.${actor}`, `${selected}:${selected === 1 ? 2 : 3}`)
    window.__documentIdentity = Math.random()
    window.__minuteTicks = new Map()
    const setInterval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window)
    window.setInterval = (handler, delay, ...args) => {
      const id = setInterval(handler, delay, ...args)
      if (delay === 60000) window.__minuteTicks.set(id, () => handler(...args))
      return id
    }
    window.clearInterval = id => { window.__minuteTicks.delete(id); return clearInterval(id) }
  }, { language, selected, actor })
  const page = await context.newPage()
  const state = { requests: [], sockets: [], logs: [], holdProfile: null, holdRefresh: null, holdLogin: null, cookieUser: actor, cookieVersion: server.sessionVersion, loginUser: '84', legacyCustomerToken }
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') state.logs.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.routeWebSocket('**/hubs/user-events*', socket => {
    const client = { socket, ready: false, closed: false }
    state.sockets.push(client)
    socket.onMessage(message => {
      for (const part of message.toString().split('\x1e').filter(Boolean)) {
        const data = JSON.parse(part)
        if (data.protocol) { socket.send('{}\x1e'); client.ready = true }
      }
    })
    socket.onClose(() => { client.closed = true })
  })
  const ping = setInterval(() => { for (const client of state.sockets) if (client.ready && !client.closed) { try { client.socket.send('{"type":6}\x1e') } catch {} } }, 5000)
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname
    if (url.origin !== origin) return route.abort()
    if (p === '/hubs/user-events/negotiate') {
      if (server.rejectHub) return problem(route, 'StaffProfileInactive', 401)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ negotiateVersion: 1, connectionId: 'test', connectionToken: 'test', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] }) })
    }
    if (p.startsWith('/api/v1/')) {
      state.requests.push({ path: p, method: request.method(), headers: request.headers(), body: request.postData() })
      if (p === '/api/v1/user/login') {
        const id = state.loginUser, denied = missingStaff(server, id), token = jwt(server, id), held = state.holdLogin
        state.holdLogin = null
        if (!denied) { state.cookieUser = id; state.cookieVersion = server.sessionVersion }
        if (held) { held.started.resolve(); await held.release.promise }
        return denied ? problem(route, 'StaffProfileInactive', server.denialStatus) : json(route, { accessToken: token })
      }
      if (p === '/api/v1/user/logout' || p === '/api/v1/user/logout-all') return route.fulfill({ status: 204 })
      if (p === '/api/v1/user/refresh') {
        if (state.legacyCustomerToken) {
          state.legacyCustomerToken = false
          const legacy = { userId: actor, name: 'Legacy', surname: 'Staff', roleId: '5', sessionVersion: server.sessionVersion, restaurantRoles: [], restaurantIds: [], permissions: [] }
          return json(route, { accessToken: `header.${Buffer.from(JSON.stringify(legacy)).toString('base64url')}.signature` })
        }
        const token = jwt(server, state.cookieUser), held = state.holdRefresh, denied = missingStaff(server, state.cookieUser)
        const revoked = state.cookieVersion !== server.sessionVersion && !['1', '5'].includes(state.cookieUser)
        state.holdRefresh = null
        if (held) { held.started.resolve(); await held.release.promise }
        return denied ? problem(route, 'StaffProfileInactive', server.denialStatus) : server.expired || revoked ? problem(route, 'SessionInvalid', 401) : json(route, { accessToken: token })
      }
      if (p === '/api/v1/profile') {
        const id = requestUser(request), payload = account(server, id), held = state.holdProfile
        const denied = missingStaff(server, id) && !server.legacyProfileResponse
        const claims = JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url').toString())
        const revoked = Number(claims.sessionVersion) !== server.sessionVersion && !['1', '5'].includes(id)
        state.holdProfile = null
        if (held) { held.started.resolve(); await held.release.promise }
        return denied ? problem(route, 'StaffProfileInactive', server.denialStatus) : server.expired || revoked ? problem(route, 'SessionInvalid', 401) : json(route, payload)
      }
      if (p === '/api/v1/localization/preference') return json(route, { language })
      if (p.includes('/localization/dictionaries/')) return json(route, { language, version: 'test', fallbackLanguage: 'az', messages: {} })
      if (/^\/api\/v1\/dashboard\/(owner|manager|platform)$/.test(p)) return json(route, {
        view: p.split('/').at(-1), paymentMode: url.searchParams.get('paymentMode') || 'real', generatedAtUtc: new Date().toISOString(),
        from: '2026-11-21T00:00:00Z', to: '2026-11-22T00:00:00Z', timeZone: 'Asia/Baku',
        restaurants: profiles.map(item => ({ id: item.restaurantId, name: item.restaurantName, branchName: null, timeZone: 'Asia/Baku' })),
        hasMoreRestaurants: false, metrics: [], financials: null, chart: { key: 'orders', unit: 'count', granularity: 'hour', points: [] },
        alerts: [], branchRows: [], sessionRows: [], pageIndex: 1, pageSize: 20, totalRows: 0,
      })
      if (p === '/api/v1/restaurants/getAll' || p === '/api/v1/public/restaurants') return json(route, profiles.map(item => ({ id: item.restaurantId, name: item.restaurantName, isActive: true, hasActiveContract: server.contracts[item.restaurantId] })))
      if (p === '/api/v1/lookups/roles') return json(route, [{ id: 2, name: 'Owner', isStaffAssignable: true }, { id: 3, name: 'Manager', isStaffAssignable: true }, { id: 4, name: 'Waiter', isStaffAssignable: true }])
      if (/\/staff\/[12]$/.test(p)) return json(route, [{ id: 7, name: `R${p.at(-1)} Worker`, surname: 'Person', email: 'staff@example.com', roleId: 4, roleName: 'Waiter', phone: '+994501234567', isActive: server.targetActive }])
      if (p === '/api/v1/staff/1/detail/7') return json(route, { id: 7, name: 'R1 Worker', surname: 'Person', email: 'staff@example.com', roleId: 4, phone: '+994501234567', isActive: server.targetActive })
      if (p === '/api/v1/restaurants/1/staff/7/activate') {
        if (server.blockedTarget) return problem(route, 'StaffAccountInactive', 409)
        server.targetActive = true; return route.fulfill({ status: 204 })
      }
      if (p === '/api/v1/restaurants/1/staff/7/deactivate') { server.targetActive = false; return route.fulfill({ status: 204 }) }
      if (p === '/api/v1/restaurants/1/staff/7' && request.method() === 'PUT') { server.targetActive = /name="IsActive"\r?\n\r?\ntrue/.test(request.postData()); return route.fulfill({ status: 204 }) }
      if (p.endsWith('/unread-count')) return json(route, { count: 0 })
      if (p.includes('/notifications/paged')) return json(route, { items: [], pageIndex: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false })
      if (p.includes('/notifications')) return json(route, { items: [], totalCount: 0 })
      return json(route, {})
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  return {
    page, state, context, t: key => catalogs[language][`ui.profiles.${key}`],
    async open(url = `/admin/staff?restaurantId=${selected}`) {
      await page.goto(origin + url)
      await page.locator('.user-pill').first().waitFor()
      await waitFor(() => state.sockets.some(client => client.ready))
    },
    event(target, payload = {}) {
      const client = state.sockets.filter(client => client.ready && !client.closed).at(-1)
      assert.ok(client, 'SignalR socket connected')
      client.socket.send(JSON.stringify({ type: 1, target, arguments: [payload] }) + '\x1e')
    },
    hold(kind) { const held = { started: defer(), release: defer() }; state[kind] = held; return held },
    async close() { clearInterval(ping); await context.close() },
  }
}
const activeLabel = async (client, restaurant) => client.page.waitForFunction(restaurant => [...document.querySelectorAll('.user-pill small')].some(node => node.textContent.includes(restaurant)), restaurant)
const notLoggedOut = async client => {
  assert.notEqual(new URL(client.page.url()).pathname, '/login')
  assert.equal(await client.page.locator('.logout-action').count() > 0, true)
  assert.equal(await client.page.evaluate(() => localStorage.getItem('ecafe.manualLogoutAt')), null)
}
const submitLogin = async (client, email = 'user42@example.com') => {
  await client.page.locator('input[type=email]').fill(email)
  await client.page.locator('input[type=password]').fill('FreshPassword1!')
  await client.page.locator('button[type=submit]').click()
}
const loginInSameDocument = async client => client.page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })

try {
  const shared = backend(), first = await setup(shared), second = await setup(shared, { selected: 2 })
  await first.open(); await second.open()
  await activeLabel(first, 'R1 Restaurant'); await activeLabel(second, 'R2 Restaurant')
  const doc1 = await first.page.evaluate(() => window.__documentIdentity), doc2 = await second.page.evaluate(() => window.__documentIdentity)
  const row = second.page.locator('.staff-member-row').first()
  await row.evaluate(node => { node.dataset.identity = 'stable' })
  const url2 = second.page.url()
  shared.profiles = [profiles[1]]
  first.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_deactivated', message: '', occurredAtUtc: new Date().toISOString() })
  second.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_deactivated', message: '', occurredAtUtc: new Date().toISOString() })
  await activeLabel(first, 'R2 Restaurant')
  await second.page.waitForFunction(() => document.querySelector('.user-profile-menu') === null && document.querySelector('a.user-pill'))
  assert.equal(second.page.url(), url2, 'Other restaurant removal does not navigate')
  assert.equal(await row.getAttribute('data-identity'), 'stable', 'Unaffected data/actions are not remounted')
  assert.equal(await first.page.evaluate(() => window.__documentIdentity), doc1)
  assert.equal(await second.page.evaluate(() => window.__documentIdentity), doc2)
  assert.equal(await first.page.locator('.staff-member-row').count(), 0, 'Old tenant actions are removed on home fallback')
  await notLoggedOut(first); await notLoggedOut(second); cases += 2
  for (const width of [1440, 390]) {
    await first.page.setViewportSize({ width, height: 900 })
    await first.page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await first.page.screenshot({ animations: 'disabled', path: path.join(dist, `profile-fallback-en-${width}-dark.png`) })
  }

  const oldAuthorization = first.state.requests.find(request => request.path === '/api/v1/profile').headers.authorization
  const refreshCount = first.state.requests.filter(request => request.path === '/api/v1/user/refresh').length
  shared.profiles = []
  shared.sessionVersion += 1
  first.event('RestaurantAccessChanged', { restaurantId: 2, reason: 'staff_access_revoked', message: '' })
  second.event('RestaurantAccessChanged', { restaurantId: 2, reason: 'staff_access_revoked', message: '' })
  await first.page.waitForURL(origin + '/login'); await second.page.waitForURL(origin + '/login')
  assert.equal(await first.page.locator('.staff-member-row').count(), 0)
  assert.equal(await first.page.locator('.logout-action').count(), 0)
  assert.equal(first.state.requests.filter(request => request.path === '/api/v1/user/refresh').length, refreshCount, '1141 does not refresh/replay')
  await first.page.getByText(catalogs.en['ui.staffAccess.inactive'], { exact: true }).waitFor()
  cases += 1
  for (const width of [1440, 390]) {
    await first.page.setViewportSize({ width, height: 900 })
    await first.page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
    await first.page.screenshot({ animations: 'disabled', path: path.join(dist, `staff-profile-login-en-${width}-light.png`) })
  }
  shared.profiles = [profiles[0]]
  shared.sessionVersion += 1
  const oldStatus = await first.page.evaluate(async authorization => (await fetch('/api/v1/profile', { headers: { Authorization: authorization } })).status, oldAuthorization)
  assert.equal(oldStatus, 401, 'Reactivation does not restore revoked tokens')
  first.state.loginUser = '42'
  await first.page.locator('input[type=email]').fill('user42@example.com')
  await first.page.locator('input[type=password]').fill('FreshPassword1!')
  await first.page.locator('button[type=submit]').click()
  await activeLabel(first, 'R1 Restaurant')
  await notLoggedOut(first); cases += 1
  // A stale revoke event received on a fresh connection is revalidated, not blindly trusted.
  const checked = first.page.waitForResponse(response => response.url().endsWith('/api/v1/profile'))
  first.event('RestaurantAccessChanged', { restaurantId: 2, reason: 'staff_access_revoked', message: '' })
  await checked
  await first.page.evaluate(() => new Promise(requestAnimationFrame))
  await notLoggedOut(first); cases += 1
  // A missed event is recovered by the actual SignalR reconnect callback.
  const oldCount = first.state.sockets.length
  shared.profiles = [profiles[1]]
  first.state.sockets.at(-1).closed = true
  await first.state.sockets.at(-1).socket.close({ code: 1012, reason: 'test reconnect' })
  try { await waitFor(() => first.state.sockets.length > oldCount && first.state.sockets.at(-1).ready) }
  catch (error) { console.log({ oldCount, sockets: first.state.sockets.map(({ ready, closed }) => ({ ready, closed })), logs: first.state.logs, requests: first.state.requests.slice(-8).map(item => item.path) }); throw error }
  await activeLabel(first, 'R2 Restaurant')
  await notLoggedOut(first); cases += 1
  await first.close(); await second.close()

  const pollingServer = backend(), polling = await setup(pollingServer, { selected: 2 })
  await polling.open()
  const documentId = await polling.page.evaluate(() => window.__documentIdentity)
  pollingServer.profiles = [profiles[0]]
  await polling.page.evaluate(() => { for (const tick of window.__minuteTicks.values()) tick() })
  await activeLabel(polling, 'R1 Restaurant')
  assert.equal(await polling.page.evaluate(() => window.__documentIdentity), documentId, 'Scheduled 60-second reconcile is not a page reload')
  await notLoggedOut(polling); cases += 1
  await polling.close()

  const rapidServer = backend(), rapid = await setup(rapidServer)
  await rapid.open()
  const oldMembership = rapid.hold('holdProfile')
  rapidServer.profiles = [profiles[1]]
  rapid.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_deactivated', message: '' })
  await oldMembership.started.promise
  rapidServer.profiles = [...profiles]
  const newRefresh = rapid.page.waitForResponse(response => response.url().endsWith('/api/v1/user/refresh'))
  rapid.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_activated', message: '' })
  await newRefresh
  const lateResponse = rapid.page.waitForResponse(response => response.url().endsWith('/api/v1/profile'))
  oldMembership.release.resolve()
  await lateResponse
  await rapid.page.evaluate(() => new Promise(requestAnimationFrame))
  await activeLabel(rapid, 'R1 Restaurant')
  await notLoggedOut(rapid); cases += 1
  await rapid.close()

  const raceServer = backend(), race = await setup(raceServer)
  await race.open()
  const held = race.hold('holdRefresh')
  race.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_activated', message: '' })
  await held.started.promise
  await race.page.locator('summary.user-pill').click()
  await race.page.locator('.user-profile-option').filter({ hasText: 'R2 Restaurant' }).click()
  await activeLabel(race, 'R2 Restaurant')
  held.release.resolve()
  await race.page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await activeLabel(race, 'R2 Restaurant')
  assert.equal(await race.page.evaluate(() => localStorage.getItem('ecafe.activeProfile.42')), '2:3')
  await notLoggedOut(race); cases += 1

  const oldProfile = race.hold('holdProfile')
  raceServer.accountActive = false
  race.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_deactivated', message: '' })
  await oldProfile.started.promise
  raceServer.accountActive = true
  await race.page.locator('.logout-action').click()
  await race.page.waitForFunction(() => document.querySelector('input[type=password]') || document.querySelector('a[href="/login"]'))
  if (await race.page.locator('input[type=password]').count() === 0) await race.page.locator('a[href="/login"]').first().click()
  await race.page.locator('input[type=email]').fill('fresh@example.com')
  await race.page.locator('input[type=password]').fill('FreshPassword1!')
  await race.page.locator('button[type=submit]').click()
  await race.page.locator('.user-pill strong').filter({ hasText: 'Fresh' }).waitFor()
  oldProfile.release.resolve()
  await race.page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await race.page.locator('.user-pill strong').filter({ hasText: 'Fresh' }).waitFor()
  await notLoggedOut(race); cases += 1
  await race.close()

  const contractServer = backend(), contract = await setup(contractServer, { selected: 2 })
  await contract.open()
  const contractUrl = contract.page.url(), contractDoc = await contract.page.evaluate(() => window.__documentIdentity)
  await contract.page.locator('.staff-member-row').first().evaluate(node => { node.dataset.contract = 'stable' })
  contractServer.contracts[1] = false
  const otherRefresh = contract.page.waitForResponse(response => response.url().endsWith('/api/v1/user/refresh'))
  contract.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'ContractExpired', message: '' })
  await otherRefresh
  assert.equal(await contract.page.locator('.staff-member-row').first().getAttribute('data-contract'), 'stable', 'Other tenant contract event leaves data mounted')
  for (const reason of ['ContractExpired', 'ContractTerminated', 'ContractActivated']) {
    contractServer.contracts[2] = reason === 'ContractActivated'
    const beforeFetch = contract.state.requests.filter(request => request.path === '/api/v1/restaurants/getAll').length
    await contract.page.locator('.staff-member-row').first().evaluate(node => { node.dataset.contract = 'old' })
    contract.event('RestaurantAccessChanged', { restaurantId: 2, reason, message: '' })
    await contract.page.waitForFunction(() => document.querySelector('.staff-member-row') && !document.querySelector('.staff-member-row').dataset.contract)
    assert.ok(contract.state.requests.filter(request => request.path === '/api/v1/restaurants/getAll').length > beforeFetch, 'Contract data is fetched again')
    assert.equal(await contract.page.locator(`.restaurant-context-meta .ui-badge-${reason === 'ContractActivated' ? 'success' : 'warning'}`).count(), 1)
    assert.equal(contract.page.url(), contractUrl)
    assert.equal(await contract.page.evaluate(() => window.__documentIdentity), contractDoc)
    await notLoggedOut(contract); cases += 1
  }
  await contract.page.locator('.staff-member-row').first().evaluate(node => { node.dataset.contract = 'old' })
  contract.event('UserRoleChanged', { message: '' })
  await contract.page.waitForFunction(() => document.querySelector('.staff-member-row') && !document.querySelector('.staff-member-row').dataset.contract)
  await notLoggedOut(contract); cases += 1
  await contract.close()

  for (const mode of ['focus', 'poll', 'reconnect', 'legacy200', '403']) {
    const server = backend(), client = await setup(server)
    await client.open()
    server.profiles = []
    if (mode === 'legacy200') server.legacyProfileResponse = true
    else server.sessionVersion += 1
    if (mode === '403') server.denialStatus = 403
    const beforeRefresh = client.state.requests.filter(request => request.path === '/api/v1/user/refresh').length
    if (mode === 'poll') await client.page.evaluate(() => { for (const tick of window.__minuteTicks.values()) tick() })
    else if (mode === 'reconnect') {
      server.rejectHub = true
      client.state.sockets.at(-1).closed = true
      await client.state.sockets.at(-1).socket.close({ code: 1012, reason: 'missed staff revoke event' })
    } else await client.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await client.page.waitForURL(origin + '/login')
    await client.page.locator('.auth-card .form-message-danger').filter({ hasText: catalogs.en['ui.staffAccess.inactive'] }).waitFor()
    assert.equal(client.state.requests.filter(request => request.path === '/api/v1/user/refresh').length, beforeRefresh, 'No refresh replay for terminal staff denial')
    assert.equal(await client.page.locator('.logout-action').count(), 0)
    await client.close(); cases += 1
  }
  for (const actor of ['5', '1']) {
    const server = backend(); server.profiles = []
    const client = await setup(server, { actor })
    await client.open('/account')
    const checked = client.page.waitForResponse(response => response.url().endsWith('/api/v1/profile'))
    client.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_access_revoked', message: '' })
    await checked
    await client.page.evaluate(() => new Promise(requestAnimationFrame))
    await notLoggedOut(client)
    await client.page.locator('.profile-account-form input[type=email]').waitFor()
    await loginInSameDocument(client)
    client.state.loginUser = actor
    await submitLogin(client, `user${actor}@example.com`)
    await client.page.locator('.user-pill strong').waitFor()
    await notLoggedOut(client); cases += 1
    if (actor === '5') {
      const beforeRefresh = client.state.requests.filter(request => request.path === '/api/v1/user/refresh').length
      await loginInSameDocument(client)
      client.state.loginUser = '42'
      await submitLogin(client)
      await client.page.locator('.auth-card .form-message-danger').filter({ hasText: catalogs.en['ui.staffAccess.inactive'] }).waitFor()
      await client.page.locator('a.brand').click()
      await client.page.locator('.user-pill strong').waitFor()
      await notLoggedOut(client)
      assert.equal(client.state.requests.filter(request => request.path === '/api/v1/user/refresh').length, beforeRefresh, 'Denied staff login does not clear an unrelated healthy Customer session')
      cases += 1
    }
    await client.close(); cases += 1
  }
  {
    const server = backend(); server.profiles = []
    const client = await setup(server, { legacyCustomerToken: true })
    await client.page.goto(origin + '/account')
    await client.page.waitForURL(origin + '/login')
    await client.page.locator('.auth-card .form-message-danger').filter({ hasText: catalogs.en['ui.staffAccess.inactive'] }).waitFor()
    assert.equal(client.state.requests.filter(request => request.path === '/api/v1/user/refresh').length, 1, 'Legacy Customer JWT cannot bypass the canonical staff denial')
    await client.close(); cases += 1
  }
  {
    const server = backend(), client = await setup(server)
    await client.open()
    await loginInSameDocument(client)
    client.state.loginUser = '42'
    const heldLogin = client.hold('holdLogin')
    await submitLogin(client)
    await heldLogin.started.promise
    await client.page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })))
    assert.equal(client.state.requests.filter(request => request.path === '/api/v1/user/login').length, 1, 'Double submit is ignored')
    await client.page.locator('a.brand').click()
    await client.page.locator('.auth-card').waitFor({ state: 'detached' })
    await loginInSameDocument(client)
    client.state.loginUser = '84'
    await submitLogin(client, 'fresh@example.com')
    await client.page.locator('.user-pill strong').filter({ hasText: 'Fresh' }).waitFor()
    const oldResponse = client.page.waitForResponse(response => response.url().endsWith('/api/v1/user/login'))
    heldLogin.release.resolve()
    await oldResponse
    await client.page.evaluate(() => new Promise(requestAnimationFrame))
    assert.match(await client.page.locator('.user-pill strong').innerText(), /Fresh/, 'Stale login success cannot overwrite a fresh session')
    await notLoggedOut(client)
    await client.close(); cases += 1
  }
  {
    const server = backend(), client = await setup(server)
    await client.open()
    server.profiles = []; server.sessionVersion += 1
    const heldDenial = client.hold('holdProfile')
    client.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_access_revoked', message: '' })
    await heldDenial.started.promise
    server.profiles = [profiles[0]]; server.sessionVersion += 1
    await loginInSameDocument(client)
    client.state.loginUser = '42'
    await submitLogin(client)
    await activeLabel(client, 'R1 Restaurant')
    const oldResponse = client.page.waitForResponse(response => response.url().endsWith('/api/v1/profile'))
    heldDenial.release.resolve()
    await oldResponse
    await client.page.evaluate(() => new Promise(requestAnimationFrame))
    await notLoggedOut(client)
    await client.close(); cases += 1
  }
  for (const language of ['az', 'en', 'ru']) {
    const server = backend(); server.profiles = []
    const client = await setup(server, { language })
    await client.page.goto(origin + '/login')
    const feedback = client.page.locator('.auth-card .form-message-danger')
    await feedback.filter({ hasText: catalogs[language]['ui.staffAccess.inactive'] }).waitFor()
    assert.equal(client.state.requests.filter(request => request.path === '/api/v1/user/refresh').length, 1)
    assert.equal(await client.page.locator('.session-termination-notice').count(), 0, 'Login reason is inline, not covering form controls')
    client.state.loginUser = '42'
    await submitLogin(client)
    await feedback.filter({ hasText: catalogs[language]['ui.staffAccess.inactive'] }).waitFor()
    assert.equal(client.state.requests.filter(request => request.path === '/api/v1/user/refresh').length, 1)
    for (const width of [1440, 390, 320]) {
      await client.page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await client.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
        assert.equal(await client.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await client.page.screenshot({ animations: 'disabled', path: path.join(dist, `staff-required-login-${language}-${width}-${theme}.png`), fullPage: true })
      }
    }
    await client.close(); cases += 2
  }

  for (const globalMethod of ['event', 'profile', 'expired']) {
    const server = backend(), client = await setup(server)
    await client.open()
    if (globalMethod === 'event') client.event('UserDeactivated', { message: 'Account blocked' })
    else {
      if (globalMethod === 'profile') server.accountActive = false
      else server.expired = true
      await client.page.evaluate(() => window.dispatchEvent(new Event('focus')))
    }
    await client.page.waitForURL(origin + '/login')
    assert.equal(await client.page.locator('.logout-action').count(), 0)
    await client.close(); cases += 1
  }
  const logoutAll = await setup(backend())
  await logoutAll.open('/account')
  await logoutAll.page.getByRole('button', { name: catalogs.en['ui.pages.customer.profile_page.butun_cihazlardan_cixis_et_32d8ca'], exact: true }).click()
  await logoutAll.page.locator('.confirm-dialog .ui-button-danger').click()
  await logoutAll.page.waitForURL(origin + '/login')
  assert.ok(logoutAll.state.requests.some(request => request.path === '/api/v1/user/logout-all'))
  await logoutAll.close(); cases += 1
  for (const language of ['az', 'en', 'ru']) {
    const server = backend(), admin = await setup(server, { actor: '1', language })
    await admin.open()
    await admin.page.getByRole('button', { name: `R1 Worker Person: ${admin.t('deactivate')}`, exact: true }).click()
    await admin.page.getByText(admin.t('staffInactive'), { exact: true }).waitFor()
    server.blockedTarget = true
    await admin.page.getByRole('button', { name: `R1 Worker Person: ${admin.t('activate')}`, exact: true }).click()
    await admin.page.getByText(admin.t('accountInactive'), { exact: true }).waitFor()
    assert.equal(await admin.page.locator('.form-message-danger').filter({ hasText: admin.t('accountInactive') }).count(), 1, 'Blocked-account rejection uses error tone')
    await notLoggedOut(admin)
    for (const width of [1440, 390, 320]) {
      await admin.page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await admin.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
        assert.equal(await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await admin.page.screenshot({ animations: 'disabled', path: path.join(dist, `profile-deactivation-${language}-${width}-${theme}.png`), fullPage: true })
      }
    }
    server.blockedTarget = false
    await admin.page.getByRole('button', { name: `R1 Worker Person: ${admin.t('activate')}`, exact: true }).click()
    await admin.page.getByText(admin.t('staffActive'), { exact: true }).waitFor()
    cases += 1
    await admin.page.goto(`${origin}/admin/staff/7/edit?restaurantId=1`)
    await admin.page.waitForFunction(() => document.querySelector('input[type=email]')?.value === 'staff@example.com')
    await admin.page.getByLabel(admin.t('staffStatus')).selectOption('false')
    await admin.page.locator('form button[type=submit]').click()
    await waitFor(() => admin.state.requests.some(request => request.path === '/api/v1/restaurants/1/staff/7' && request.method === 'PUT'))
    const update = admin.state.requests.findLast(request => request.path === '/api/v1/restaurants/1/staff/7' && request.method === 'PUT')
    assert.match(update.body, /name="IsActive"\r?\n\r?\nfalse/)
    assert.equal(server.accountActive, true)
    await notLoggedOut(admin); cases += 1
    await admin.page.goto(`${origin}/admin/staff/new?restaurantId=1`)
    await admin.page.locator('form .form-grid.two').first().locator('input').nth(0).fill('New')
    await admin.page.locator('form .form-grid.two').first().locator('input').nth(1).fill('Worker')
    await admin.page.locator('form input[type=email]').fill('new@example.com')
    await admin.page.locator('.phone-field-control input').fill('1234567')
    await admin.page.locator('form select').filter({ has: admin.page.locator('option[value="4"]') }).selectOption('4')
    await admin.page.getByLabel(admin.t('staffStatus')).selectOption('false')
    await admin.page.locator('form button[type=submit]').click()
    await waitFor(() => admin.state.requests.some(request => request.path === '/api/v1/users' && request.method === 'POST'))
    assert.match(admin.state.requests.findLast(request => request.path === '/api/v1/users' && request.method === 'POST').body, /name="IsActive"\r?\n\r?\nfalse/)
    await notLoggedOut(admin); cases += 1
    await admin.close()
  }
  assert.deepEqual(errors, [])
  console.log(`PASS ${cases} staff-profile browser scenarios: real SignalR mock transport, two restaurants/two browsers, scoped fallback, required staff profile, Customer/Admin login, reactivation, lost-event reconnect, selection/login races, true global blocks/expiry, localized 409, AZ/EN/RU desktop/mobile/dark/light screenshots`)
} finally { await browser.close() }
