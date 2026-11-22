import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://ecafe.test', dist = path.resolve('dist')
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map(language => [language, JSON.parse(fs.readFileSync(`src/shared/i18n/catalog/${language}.json`, 'utf8'))]))
const handoff = JSON.parse(fs.readFileSync('docs/tenant-access-boundaries-ui-messages.json', 'utf8'))
for (const language of ['az', 'en', 'ru']) assert.deepEqual(handoff[language], Object.fromEntries(Object.entries(catalogs[language]).filter(([key]) => key.startsWith('ui.tenantAccess.'))))
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const pageErrors = [], failures = []
let cases = 0
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const waitFor = async check => { const until = Date.now() + 10000; while (!check()) { assert.ok(Date.now() < until); await new Promise(resolve => setTimeout(resolve, 10)) } }
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
const denied = route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'AccessDenied', message: 'Access denied' }) })
const notification = (restaurantId, read = false) => ({ id: Number(restaurantId) * 100 + 1, restaurantId: Number(restaurantId), title: `Private ${restaurantId === '1' ? 'A' : 'B'}`, message: `Restaurant ${restaurantId} only`, isRead: read, typeName: 'ReservationConfirmed', relatedEntityType: 'Reservation', relatedEntityId: Number(restaurantId) * 10, payloadJson: JSON.stringify({ restaurantId, reservationId: `${restaurantId}0` }), createdAt: '2026-11-22T08:00:00Z' })

async function setup({ role = 3, language = 'en' } = {}) {
  const state = { requests: [], sockets: [], profiles: [1, 2], denied: new Set(), read: new Set(), holds: [], targetActive: true }
  const staff = () => [1, 5].includes(role) ? [] : state.profiles.map(id => ({ restaurantId: id, restaurantName: `Restaurant ${id === 1 ? 'A' : 'B'}`, roleId: role, roleName: 'Staff', isActive: true }))
  const profile = () => ({ userId: '42', name: 'Test', surname: 'Actor', email: 'actor@example.com', phone: '+994501234567', roleId: role, isActive: true, profiles: staff() })
  const jwt = () => `header.${Buffer.from(JSON.stringify({ ...profile(), roleId: String(role), restaurantId: staff()[0]?.restaurantId, restaurantRoles: staff().map(p => `${p.restaurantId}:${p.roleId}`), restaurantIds: staff().map(p => String(p.restaurantId)), permissions: ['ManageUsers', 'ManageRestaurants', 'ManageStaff'] })).toString('base64url')}.signature`
  const restaurants = [1, 2].map(id => ({ id, name: `Restaurant ${id === 1 ? 'A' : 'B'}`, branchName: 'Baku', location: 'Baku', isActive: true, hasActiveContract: true, phone: '+994501234567', workingHours: [] }))
  const member = () => ({ id: 7, userId: 7, name: 'Shared Staff', surname: 'Member', email: 'member@example.com', phone: '+994501234567', restaurantId: 1, roleId: 4, roleName: 'Waiter', isActive: state.targetActive })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ language, role }) => {
    localStorage.setItem('ecafe.language', language)
    localStorage.setItem('ecafe.activeProfile.42', `1:${role}`)
    window.__identity = Math.random()
    window.__unhandled = []
    window.addEventListener('unhandledrejection', e => window.__unhandled.push(String(e.reason)))
  }, { language, role })
  const page = await context.newPage()
  page.on('pageerror', e => pageErrors.push(e.message))
  await page.routeWebSocket('**/hubs/user-events*', socket => {
    const connection = { socket, ready: false, closed: false }; state.sockets.push(connection)
    socket.onMessage(message => { for (const part of message.toString().split('\x1e').filter(Boolean)) if (JSON.parse(part).protocol) { socket.send('{}\x1e'); connection.ready = true } })
    socket.onClose(() => { connection.closed = true })
  })
  const ping = setInterval(() => { for (const c of state.sockets) if (c.ready && !c.closed) { try { c.socket.send('{"type":6}\x1e') } catch {} } }, 5000)
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname
    if (url.origin !== origin) return route.abort()
    if (p === '/hubs/user-events/negotiate') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ negotiateVersion: 1, connectionId: 'test', connectionToken: 'test', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] }) })
    if (p.startsWith('/api/v1/')) {
      const scope = req.headers()['x-active-restaurant-id'] || ''
      const request = { path: p, method: req.method(), scope, body: req.postData(), headers: req.headers() }; state.requests.push(request)
      const hold = state.holds.find(h => !h.used && h.match(request))
      const accessDenied = state.denied.has(scope)
      const items = [1, 5].includes(role) ? [notification('1', state.read.has('1')), notification('2', state.read.has('2'))] : [notification(scope || '1', state.read.has(scope))]
      if (hold) { hold.used = true; hold.started.resolve(); await hold.release.promise; hold.released.resolve() }
      if (/\/user\/(refresh|login)$/.test(p)) return json(route, { accessToken: jwt() })
      if (p.includes('/user/logout')) return route.fulfill({ status: 204 })
      if (p === '/api/v1/profile') return json(route, profile())
      if (p === '/api/v1/notifications' || p.startsWith('/api/v1/notifications/')) {
        if (accessDenied) return denied(route)
        if (req.method() === 'POST' && state.expireNextMutation) {
          state.expireNextMutation = false
          return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'SessionExpired', message: 'Expired token' }) })
        }
        if (p.endsWith('/unread-count')) return json(route, { count: items.filter(n => !n.isRead).length })
        if (req.method() === 'POST') {
          if (p.endsWith('/read-all')) for (const item of items) state.read.add(String(item.restaurantId))
          else state.read.add(String(Math.floor(Number(p.split('/').at(-2)) / 100)))
          return route.fulfill({ status: 204 })
        }
        return json(route, items)
      }
      if (p === '/api/v1/users/7' && req.method() === 'DELETE') return role === 1 ? route.fulfill({ status: 204 }) : denied(route)
      if (p === '/api/v1/restaurant-groups') {
        if (role !== 1) { failures.push('Non-admin group API call'); return denied(route) }
        return req.method() === 'POST' ? route.fulfill({ status: 201 }) : json(route, [{ id: 1, name: 'Global Group', email: 'group@example.com', isActive: true }])
      }
      if (p.includes('localization/dictionaries')) return json(route, { language, version: 'test', fallbackLanguage: 'az', messages: {} })
      if (p.includes('localization/preference')) return json(route, { language })
      if (p === '/api/v1/restaurants/getAll' || p === '/api/v1/public/restaurants') return json(route, restaurants)
      if (/\/restaurant\/getById\/[12]$/.test(p)) return json(route, restaurants[Number(p.at(-1)) - 1])
      if (p === '/api/v1/lookups/roles') return json(route, [{ id: 4, name: 'Waiter', isStaffAssignable: true }])
      if (/\/staff\/[12]$/.test(p)) return json(route, [member()])
      if (p === '/api/v1/restaurants/1/staff/7/deactivate') { state.targetActive = false; return route.fulfill({ status: 204 }) }
      if (p === '/api/v1/restaurants/1/staff/7/activate') { state.targetActive = true; return route.fulfill({ status: 204 }) }
      if (/\/dashboard\/(owner|manager|platform)$/.test(p)) return json(route, { view: p.split('/').at(-1), paymentMode: 'real', generatedAtUtc: '2026-11-22T08:00:00Z', from: '2026-11-21T00:00:00Z', to: '2026-11-22T00:00:00Z', timeZone: 'Asia/Baku', restaurants: [], metrics: [], financials: null, chart: { key: 'orders', unit: 'count', granularity: 'hour', points: [] }, alerts: [], branchRows: [], sessionRows: [], pageIndex: 1, pageSize: 20, totalRows: 0 })
      return json(route, {})
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  return {
    page, context, state, t: key => catalogs[language][`ui.tenantAccess.${key}`],
    async open(route = '/notifications') { await page.goto(origin + route); await page.locator('.user-pill').waitFor(); await waitFor(() => state.sockets.some(c => c.ready)); },
    async go(route) { await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')) }, route) },
    hold(match) { const h = { match, used: false, started: deferred(), release: deferred(), released: deferred() }; state.holds.push(h); return h },
    event(target, payload) { state.sockets.filter(c => c.ready && !c.closed).at(-1).socket.send(JSON.stringify({ type: 1, target, arguments: [payload] }) + '\x1e') },
    async close() { assert.deepEqual(await page.evaluate(() => window.__unhandled), []); clearInterval(ping); await context.close() },
  }
}
async function switchB(client) {
  await client.page.locator('.user-profile-switcher summary').click()
  await client.page.locator('.user-profile-option').filter({ hasText: 'Restaurant B' }).click()
  await client.page.waitForFunction(() => document.querySelector('.user-pill small')?.textContent.includes('Restaurant B'))
}
async function showBell(c) { if (!(await c.page.locator('.notification-popover').isVisible())) await c.page.locator('.notification-trigger').click() }
async function ready(c, surface) { if (surface === 'bell') await showBell(c); await c.page.locator(surface === 'bell' ? '.notification-list button' : '.notification-page-list button').filter({ hasText: 'Private A' }).waitFor() }
const post = r => r.path.startsWith('/api/v1/notifications/') && r.method === 'POST'

try {
  for (const role of [2, 3]) {
    const c = await setup({ role })
    await c.open('/admin/staff?restaurantId=1')
    await c.page.locator('.staff-member-row').waitFor()
    assert.equal(await c.page.locator('button:has(svg.lucide-trash-2)').count(), 0, 'Owner/manager cannot delete a global account despite stale ManageUsers claims')
    await c.page.locator('button[title="Deactivate profile"]').click()
    await c.page.locator('button[title="Activate profile"]').waitFor()
    await c.page.locator('button[title="Activate profile"]').click()
    await c.page.locator('button[title="Deactivate profile"]').waitFor()
    assert.equal(c.state.requests.filter(r => r.path === '/api/v1/users/7').length, 0)
    assert.equal(c.state.requests.filter(r => /\/staff\/7\/(deactivate|activate)$/.test(r.path) && r.scope === '1').length, 2)
    cases += 1
    for (const route of ['/admin/restaurants', '/admin/restaurants/1/edit', '/admin/restaurants/new', '/admin/restaurant-groups', '/admin/restaurant-groups/new']) {
      await c.go(route)
      await c.page.locator('main h1').waitFor()
      await c.page.evaluate(() => new Promise(requestAnimationFrame))
      assert.equal(c.state.requests.filter(r => r.path === '/api/v1/restaurant-groups').length, 0)
      cases += 1
    }
    await c.close()
  }
  for (const language of ['az', 'en', 'ru']) {
    const c = await setup({ role: 1, language })
    await c.open('/admin/staff?restaurantId=1')
    await c.page.getByRole('button', { name: `Shared Staff Member: ${c.t('accountDeleteAction')}`, exact: true }).click()
    const modal = c.page.locator('.confirm-dialog')
    await modal.getByText(c.t('accountDeleteMessage').replace('{{name}}', 'Shared Staff Member'), { exact: true }).waitFor()
    assert.equal(c.state.requests.filter(r => r.method === 'DELETE').length, 0, 'Opening confirmation does not delete')
    for (const width of [1440, 390, 320]) {
      await c.page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await c.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
        const box = await modal.boundingBox()
        assert.ok(box.x >= 0 && box.x + box.width <= width)
        assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await c.page.screenshot({ path: path.join(dist, `tenant-delete-${language}-${width}-${theme}.png`), animations: 'disabled' })
      }
    }
    await modal.getByRole('button', { name: catalogs[language]['ui.common.cancel'], exact: true }).click()
    assert.equal(c.state.requests.filter(r => r.method === 'DELETE').length, 0)
    await c.page.getByRole('button', { name: `Shared Staff Member: ${c.t('accountDeleteAction')}`, exact: true }).click()
    const h = c.hold(r => r.path === '/api/v1/users/7' && r.method === 'DELETE')
    await modal.getByRole('button', { name: c.t('accountDeleteAction'), exact: true }).click()
    await h.started.promise
    await modal.locator('.ui-button-danger').evaluate(button => button.click())
    assert.equal(c.state.requests.filter(r => r.method === 'DELETE').length, 1)
    h.release.resolve()
    await modal.waitFor({ state: 'detached' })
    await c.page.getByText(c.t('accountDeleteSuccess'), { exact: true }).waitFor()
    await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 1 })
    await c.open('/admin/restaurant-groups')
    await c.page.getByText('Global Group', { exact: true }).waitFor()
    await c.go('/admin/restaurant-groups/new')
    await c.page.locator('form input').nth(0).fill('New Group')
    await c.page.locator('form input[type=email]').fill('new@example.com')
    await c.page.locator('form button[type=submit]').click()
    await c.page.getByText(catalogs.en['ui.adminFlow.groupCreated'], { exact: true }).waitFor()
    assert.equal(c.state.requests.filter(r => r.path === '/api/v1/restaurant-groups' && r.method === 'POST').length, 1)
    await c.close(); cases += 1
  }
  for (const surface of ['bell', 'page']) {
    const c = await setup(); await c.open(); await ready(c, surface)
    const held = c.hold(r => r.path === '/api/v1/notifications' && r.scope === '1')
    await c.page.evaluate(() => window.dispatchEvent(new Event('ecafe:notifications-refresh')))
    await held.started.promise
    await switchB(c)
    await c.go('/notifications')
    if (surface === 'bell') await showBell(c)
    await c.page.getByText('Private B', { exact: true }).first().waitFor()
    const response = c.page.waitForResponse(r => r.url() === origin + '/api/v1/notifications' && r.request().headers()['x-active-restaurant-id'] === '1')
    held.release.resolve(); await response
    await c.page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(await c.page.getByText('Private A', { exact: true }).count(), 0)
    await c.close(); cases += 1
  }
  for (const surface of ['bell', 'page']) for (const operation of ['read', 'read-all']) {
    const c = await setup(); await c.open(); await ready(c, surface)
    const held = c.hold(r => post(r) && r.scope === '1')
    if (operation === 'read') await c.page.locator(surface === 'bell' ? '.notification-list button' : '.notification-page-list button').filter({ hasText: 'Private A' }).click()
    else await c.page.locator(surface === 'bell' ? '.notification-popover header button' : '.page-header button').click()
    await held.started.promise
    await switchB(c); await c.go('/notifications'); await c.page.getByText('Private B', { exact: true }).waitFor()
    const expectedUrl = c.page.url()
    held.release.resolve(); await held.released.promise
    await c.page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(c.page.url(), expectedUrl, 'Old read cannot navigate the new tenant')
    assert.equal(c.state.read.has('2'), false)
    await c.page.locator('.notification-page-list .ui-badge-warning').waitFor()
    assert.equal(c.state.requests.filter(r => post(r) && r.scope === '2').length, 0)
    await c.close(); cases += 1
  }
  for (const surface of ['bell', 'page']) for (const operation of ['list', 'read', 'read-all']) {
    const c = await setup(); await c.open(); await ready(c, surface)
    c.state.denied.add('1')
    const currentUrl = c.page.url()
    if (operation === 'list') await c.page.evaluate(() => window.dispatchEvent(new Event('ecafe:notifications-refresh')))
    else if (operation === 'read') await c.page.locator(surface === 'bell' ? '.notification-list button' : '.notification-page-list button').filter({ hasText: 'Private A' }).click()
    else await c.page.locator(surface === 'bell' ? '.notification-popover header button' : '.page-header button').click()
    await c.page.locator(surface === 'bell' ? '.notification-popover .form-message-danger' : '.notification-page-list .form-message-danger').filter({ hasText: c.t('notificationsDenied') }).waitFor()
    assert.equal(await c.page.locator(surface === 'bell' ? '.notification-list button.unread' : '.notification-page-list > button').count(), 0)
    assert.equal(c.page.url(), currentUrl, 'Tenant 403 does not log out an active account or navigate')
    assert.ok(await c.page.locator('.logout-action').count())
    if (surface === 'bell' && operation === 'list') for (const width of [1440, 320]) {
      await c.page.setViewportSize({ width, height: 900 })
      assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await c.page.screenshot({ path: path.join(dist, `tenant-notifications-denied-${width}.png`), animations: 'disabled' })
    }
    await switchB(c); await c.go('/notifications'); await c.page.getByText('Private B', { exact: true }).waitFor()
    assert.equal(await c.page.getByText(c.t('notificationsDenied'), { exact: true }).count(), 0)
    await c.close(); cases += 1
  }
  for (const role of [1, 5]) {
    const c = await setup({ role }); await c.open()
    await c.page.locator('.notification-page-list').getByText('Private A', { exact: true }).waitFor()
    await c.page.locator('.notification-page-list').getByText('Private B', { exact: true }).waitFor()
    assert.ok(c.state.requests.filter(r => r.path === '/api/v1/notifications').every(r => !r.scope), 'Global/customer notification scope remains unrestricted by a restaurant header')
    await c.page.locator('.page-header button').click()
    await waitFor(() => c.state.read.has('1') && c.state.read.has('2'))
    await c.close(); cases += 1
  }
  {
    const c = await setup(); await c.open(); await ready(c, 'bell')
    c.state.denied.add('1')
    const held = c.hold(r => post(r) && r.scope === '1')
    await c.page.locator('.notification-list button').filter({ hasText: 'Private A' }).click()
    await held.started.promise
    c.state.profiles = [2]
    c.event('RestaurantAccessChanged', { restaurantId: 1, reason: 'staff_deactivated', message: '' })
    await c.page.waitForFunction(() => document.querySelector('.user-pill small')?.textContent.includes('Restaurant B'))
    await c.go('/notifications'); await c.page.getByText('Private B', { exact: true }).waitFor()
    const expected = c.page.url()
    held.release.resolve(); await held.released.promise
    await c.page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(c.page.url(), expected)
    assert.equal(await c.page.getByText(c.t('notificationsDenied'), { exact: true }).count(), 0)
    assert.ok(await c.page.locator('.logout-action').count())
    await c.close(); cases += 1
  }
  for (const operation of ['read', 'read-all']) {
    const c = await setup(); await c.open(); await ready(c, 'page')
    const held = c.hold(r => r.path === '/api/v1/user/refresh')
    c.state.expireNextMutation = true
    if (operation === 'read') await c.page.locator('.notification-page-list button').filter({ hasText: 'Private A' }).click()
    else await c.page.locator('.page-header button').click()
    await held.started.promise
    await switchB(c); await c.go('/notifications'); await c.page.getByText('Private B', { exact: true }).waitFor()
    const refreshed = c.page.waitForResponse(r => r.url().endsWith('/api/v1/user/refresh'))
    held.release.resolve(); await refreshed
    await c.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(c.state.requests.filter(r => post(r) && r.scope === '2').length, 0, 'A mutation must not replay in B after token refresh')
    assert.equal(c.state.read.has('2'), false)
    await c.page.locator('.notification-page-list .ui-badge-warning').waitFor()
    assert.ok(await c.page.locator('.logout-action').count())
    await c.close(); cases += 1
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(failures, [])
  console.log(`PASS ${cases} tenant-boundary browser scenarios: admin-only global deletion/groups, scoped staff activation, AZ/EN/RU responsive confirmation, delayed list/read/read-all/profile switch, revoked A/active B, scoped 403 cleanup and Customer/Admin mixed-restaurant notifications`)
} finally { await browser.close() }
