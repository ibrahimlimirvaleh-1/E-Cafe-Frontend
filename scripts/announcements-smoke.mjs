import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://ecafe.test', dist = path.resolve('dist')
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map(l => [l, JSON.parse(fs.readFileSync(`src/shared/i18n/catalog/${l}.json`, 'utf8'))]))
const handoff = JSON.parse(fs.readFileSync('docs/role-targeted-announcements-ui-messages.json', 'utf8'))
for (const l of ['az', 'en', 'ru']) assert.deepEqual(handoff[l], Object.fromEntries(Object.entries(catalogs[l]).filter(([k]) => k.startsWith('ui.announcements.'))))
const destinations = { CustomerProfile: [5], CustomerReservations: [5], CustomerOrders: [5], WaiterTables: [4], KitchenOrders: [6], Inventory: [1, 2, 3], DashboardReports: [1, 2, 3], AnnouncementAdmin: [1] }
const defaultDest = { 1: 'AnnouncementAdmin', 2: 'DashboardReports', 3: 'Inventory', 4: 'WaiterTables', 5: 'CustomerProfile', 6: 'KitchenOrders' }
const now = '2026-11-23T10:00:00Z'
const item = (role, id = 1, version = 1) => ({ id, version, title: `Update ${role}/${id}`, body: `Release for role ${role}.`, destination: defaultDest[role], publishedAtUtc: now })
const adminItem = (id = 9, version = 1) => ({ id, version, destination: 'CustomerProfile', roleIds: [5], texts: ['az', 'en', 'ru'].map(language => ({ language, title: `Draft ${language}`, body: `Release ${language}` })), createdAtUtc: now, updatedAtUtc: null, publishedAtUtc: null, expiresAtUtc: null, isPublished: false })
const defer = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const waitFor = async check => { const until = Date.now() + 10000; while (!check()) { assert.ok(Date.now() < until, 'Mock state not reached'); await new Promise(r => setTimeout(r, 10)) } }
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
const problem = (route, code, status) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message: 'Provider internals must not display' }) })
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
let cases = 0
const errors = []
async function setup({ role = 5, language = 'en', profiles = [1, 5].includes(role) ? [] : [{ restaurantId: 1, restaurantName: 'Restaurant A', roleId: role, isActive: true }], selected, chooser = false, shared = { seen: new Set() } } = {}) {
  const state = { requests: [], sockets: [], holds: [], feed: null, pendingError: null, ackError: null, ackStatus: 204, loginUser: '84', user: '42', rows: shared.catalog || [adminItem()], adminError: null, capabilities: Object.entries(destinations).map(([key, roleIds]) => ({ key, roleIds })), next: null, hasMore: false }
  const profile = id => ({ userId: id, name: id === '84' ? 'Fresh' : 'Current', surname: 'User', email: `user${id}@example.com`, phone: '+994501234567', roleId: id === '84' ? 5 : role, isActive: true, profiles: id === '84' ? [] : profiles })
  const jwt = id => `header.${Buffer.from(JSON.stringify({ ...profile(id), roleId: String(id === '84' ? 5 : role), restaurantId: profiles[0]?.restaurantId, restaurantIds: profiles.map(p => String(p.restaurantId)), restaurantRoles: profiles.map(p => `${p.restaurantId}:${p.roleId}`), permissions: [] })).toString('base64url')}.signature`
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ language, selected, chooser, profiles }) => {
    localStorage.setItem('ecafe.language', language)
    if (!chooser && profiles.length) localStorage.setItem('ecafe.activeProfile.42', selected || `${profiles[0].restaurantId}:${profiles[0].roleId}`)
    window.__identity = Math.random(); window.__unhandled = []
    window.addEventListener('unhandledrejection', e => window.__unhandled.push(String(e.reason)))
  }, { language, selected, chooser, profiles })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.routeWebSocket('**/hubs/user-events*', socket => {
    const c = { socket, ready: false, closed: false }; state.sockets.push(c)
    socket.onMessage(m => { for (const p of m.toString().split('\x1e').filter(Boolean)) if (JSON.parse(p).protocol) { socket.send('{}\x1e'); c.ready = true } })
    socket.onClose(() => { c.closed = true })
  })
  const ping = setInterval(() => { for (const c of state.sockets) if (c.ready && !c.closed) { try { c.socket.send('{"type":6}\x1e') } catch {} } }, 5000)
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname
    if (url.origin !== origin) return route.abort()
    if (p === '/hubs/user-events/negotiate') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ negotiateVersion: 1, connectionId: 'test', connectionToken: 'test', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] }) })
    if (p.startsWith('/api/v1/')) {
      let uid = state.user; try { uid = String(JSON.parse(Buffer.from(req.headers().authorization.split('.')[1], 'base64url').toString()).userId) } catch {}
      const activeRole = Number(req.headers()['x-active-role-id'] || (uid === '84' ? 5 : role)), restaurantId = req.headers()['x-active-restaurant-id'] ? Number(req.headers()['x-active-restaurant-id']) : null
      const record = { path: p, url: req.url(), method: req.method(), body: req.postData(), role: activeRole, restaurantId, uid, headers: req.headers() }; state.requests.push(record)
      const h = state.holds.find(h => !h.used && h.match(record)), snapshot = profile(uid)
      const catalogItems = shared.catalog?.filter(row => row.isPublished && row.roleIds.includes(activeRole)).map(row => ({ id: row.id, version: row.version, title: row.texts.find(t => t.language === language).title, body: row.texts.find(t => t.language === language).body, destination: row.destination, publishedAtUtc: row.publishedAtUtc }))
      const feed = structuredClone(state.feed || { roleId: activeRole, restaurantId: activeRole === 5 ? null : restaurantId, items: (catalogItems || [item(activeRole), item(activeRole, 2), item(activeRole, 3)]).filter(i => !shared.seen.has(`${uid}:${activeRole}:${i.id}:${i.version}`)).slice(0, 3), hasMore: !catalogItems })
      const pe = state.pendingError, ae = state.ackError
      if (h) { h.used = true; h.started.resolve(); await h.release.promise; h.released.resolve() }
      if (p === '/api/v1/user/refresh') return json(route, { accessToken: jwt(state.user) })
      if (p === '/api/v1/user/login') { state.user = state.loginUser; return json(route, { accessToken: jwt(state.user) }) }
      if (p === '/api/v1/profile') return json(route, snapshot)
      if (p === '/api/v1/announcements/pending') return pe ? problem(route, pe.code, pe.status) : json(route, feed)
      if (/\/announcements\/\d+\/acknowledge$/.test(p)) {
        if (ae) return problem(route, ae.code, ae.status)
        const version = JSON.parse(req.postData()).version, id = Number(p.split('/').at(-2))
        if (state.ackStatus === 204) shared.seen.add(`${uid}:${activeRole}:${id}:${version}`)
        return state.ackStatus === 204 ? route.fulfill({ status: 204 }) : json(route, {}, state.ackStatus)
      }
      if (p.startsWith('/api/v1/admin/announcements')) {
        if (role !== 1 || uid !== '42') return problem(route, 'AccessDenied', 403)
        if (state.adminError && req.method() !== 'GET') { const error = state.adminError; state.adminError = null; return problem(route, error.code, error.status) }
        if (p.endsWith('/destinations')) return json(route, state.capabilities)
        if (req.method() === 'GET') return json(route, url.searchParams.has('beforeId') ? { items: [{ ...adminItem(8), texts: ['az', 'en', 'ru'].map(language => ({ language, title: `Older ${language}`, body: 'Older release' })) }], hasMore: false, nextBeforeId: null } : { items: state.rows, hasMore: state.hasMore, nextBeforeId: state.next })
        const body = JSON.parse(req.postData()), id = Number(p.split('/').findLast(x => /^\d+$/.test(x)))
        if (p.endsWith('/publish') || p.endsWith('/unpublish')) {
          const row = state.rows.find(r => r.id === id)
          if (body.expectedVersion !== row.version) return problem(route, 'AnnouncementChanged', 409)
          row.isPublished = p.endsWith('/publish'); row.publishedAtUtc = row.isPublished ? now : null; row.updatedAtUtc = now
          return json(route, row)
        }
        const row = req.method() === 'PUT' ? state.rows.find(r => r.id === id) : { ...adminItem(10), version: 0 }
        if (req.method() === 'PUT' && body.expectedVersion !== row.version) return problem(route, 5202, 409)
        if (row.isPublished) return problem(route, 5203, 409)
        Object.assign(row, body, { version: row.version + 1 }); delete row.expectedVersion
        if (req.method() === 'PUT') row.updatedAtUtc = now
        if (req.method() === 'POST') state.rows.unshift(row)
        return json(route, row)
      }
      if (p.includes('localization/dictionaries')) return json(route, { language, version: 'test', fallbackLanguage: 'az', messages: {} })
      if (p.includes('localization/preference')) return json(route, { language })
      if (p.endsWith('/unread-count')) return json(route, { count: 0 })
      if (p.includes('/notifications')) return json(route, [])
      if (/\/dashboard\/(owner|manager|platform)$/.test(p)) return json(route, { view: p.split('/').at(-1), paymentMode: 'real', generatedAtUtc: now, from: now, to: now, timeZone: 'Asia/Baku', restaurants: [], metrics: [], financials: null, chart: { key: 'orders', unit: 'count', granularity: 'hour', points: [] }, alerts: [], branchRows: [], sessionRows: [], pageIndex: 1, pageSize: 20, totalRows: 0 })
      return json(route, {})
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  return { page, state, context, shared, t: k => catalogs[language][`ui.announcements.${k}`],
    hold(match) { const h = { match, used: false, started: defer(), release: defer(), released: defer() }; state.holds.push(h); return h },
    async open(route = '/notifications') { await page.goto(origin + route); await page.locator('.user-pill').waitFor(); await waitFor(() => state.sockets.some(s => s.ready)) },
    async go(route) { await page.evaluate(route => { history.pushState({ key: String(Math.random()) }, '', route); dispatchEvent(new PopStateEvent('popstate')) }, route) },
    async switchTo(name) { await page.locator('.user-profile-switcher summary').click(); await page.locator('.user-profile-option').filter({ hasText: name }).click() },
    async close() { assert.deepEqual(await page.evaluate(() => window.__unhandled), []); clearInterval(ping); await context.close() },
  }
}
const pending = c => c.state.requests.filter(r => r.path === '/api/v1/announcements/pending')
const receipts = c => c.state.requests.filter(r => r.path.endsWith('/acknowledge'))
const panel = c => c.page.locator('.announcement-panel')
async function tick(c) { await c.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
try {
  for (const role of [1, 2, 3, 4, 5, 6]) {
    const c = await setup({ role }); await c.open();
    try { await panel(c).getByText(`Update ${role}/1`, { exact: true }).waitFor({ timeout: 5000 }) }
    catch (error) { console.log(JSON.stringify({ role, requests: c.state.requests.map(r => ({ path: r.path, role: r.role, restaurantId: r.restaurantId })), page: await c.page.locator('body').innerText() })); throw error }
    assert.equal(pending(c).length, 1)
    assert.equal(await panel(c).getAttribute('role'), 'region')
    assert.equal(await c.page.locator('.modal-backdrop').count(), 0)
    await panel(c).getByRole('button', { name: c.t('next'), exact: true }).click()
    await panel(c).getByText(`Update ${role}/2`, { exact: true }).waitFor()
    assert.deepEqual(JSON.parse(receipts(c)[0].body), { version: 1 })
    await panel(c).getByRole('button', { name: c.t('dismiss'), exact: true }).click(); await panel(c).waitFor({ state: 'detached' })
    assert.deepEqual(receipts(c).map(r => Number(r.path.split('/').at(-2))), [1, 2], 'Unseen card3 is not acknowledged')
    assert.equal(pending(c).length, 1); await c.close(); cases += 1
  }
  for (const language of ['az', 'en', 'ru']) {
    const c = await setup({ language }); await c.open(); await panel(c).waitFor()
    for (const width of [1440, 390, 320]) {
      await c.page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark']) {
        await c.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
        const b = await panel(c).boundingBox(); assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= 901)
        assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await c.page.screenshot({ path: path.join(dist, `announcement-${language}-${width}-${theme}.png`), animations: 'disabled' })
      }
    }
    await panel(c).getByRole('button', { name: c.t('open'), exact: true }).click(); await c.page.waitForURL(origin + '/account')
    assert.equal(receipts(c).length, 1)
    assert.equal(c.state.requests.some(r => r.path.includes('account-deletion')), false, 'Profile CTA never performs account deletion')
    await c.close(); cases += 1
  }
  {
    const c = await setup(); const h = c.hold(r => r.path === '/api/v1/profile'); await c.open(); await h.started.promise
    assert.equal(pending(c).length, 0, 'JWT alone is insufficient')
    h.release.resolve(); await panel(c).waitFor(); await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 2, chooser: true, profiles: [{ restaurantId: 1, restaurantName: 'Restaurant A', roleId: 2, isActive: true }, { restaurantId: 2, restaurantName: 'Restaurant B', roleId: 3, isActive: true }] })
    await c.open(); await c.page.locator('.profile-selection-modal').waitFor()
    assert.equal(pending(c).length, 0)
    await c.page.locator('.profile-selection-list button').filter({ hasText: 'Restaurant B' }).click()
    await panel(c).getByText('Update 3/1', { exact: true }).waitFor()
    assert.equal(pending(c)[0].role, 3); assert.equal(pending(c)[0].restaurantId, 2)
    await c.close(); cases += 1
  }
  for (const obstruction of ['dialog', 'custom', 'sensitive-route', 'dirty-form', 'hidden']) {
    const c = await setup(); await c.open(obstruction === 'sensitive-route' ? '/account' : '/notifications')
    if (obstruction !== 'sensitive-route') {
      await panel(c).waitFor()
      await c.page.evaluate(kind => {
        if (kind === 'dialog') { const n = document.createElement('dialog'); n.id = 'test-obstruction'; document.body.append(n); n.showModal() }
        if (kind === 'custom') { const n = document.createElement('div'); n.id = 'test-obstruction'; n.setAttribute('aria-modal', 'true'); document.body.append(n) }
        if (kind === 'dirty-form') { const f = document.createElement('form'); f.id = 'test-obstruction'; f.innerHTML = '<input>'; document.body.append(f); f.querySelector('input').dispatchEvent(new Event('input', { bubbles: true })) }
        if (kind === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) }
      }, obstruction)
    } else await waitFor(() => pending(c).length === 1)
    await panel(c).waitFor({ state: 'detached' }); assert.equal(receipts(c).length, 0)
    await c.page.evaluate(() => { document.querySelector('#test-obstruction')?.remove(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
    if (obstruction === 'sensitive-route' || obstruction === 'dirty-form') await c.go('/notifications?ready=1')
    try { await panel(c).waitFor({ timeout: 5000 }) }
    catch (error) { console.log(JSON.stringify({ obstruction, url: c.page.url(), pending: pending(c).length, page: await c.page.locator('body').innerText(), dialogs: await c.page.evaluate(() => [...document.querySelectorAll('dialog[open], [aria-modal="true"], form:focus-within')].map(n => n.outerHTML.slice(0, 100))) })); throw error }
    assert.equal(pending(c).length, 1)
    await c.close(); cases += 1
  }
  for (const wrong of ['role', 'restaurant', 'url', 'html', 'tooMany', 'schema']) {
    const c = await setup()
    c.state.feed = { roleId: wrong === 'role' ? 3 : 5, restaurantId: wrong === 'restaurant' ? 1 : null, items: [item(5)], hasMore: false }
    if (wrong === 'url') c.state.feed.items[0].destination = 'https://evil.test'
    if (wrong === 'html') c.state.feed.items[0].body = '<script>alert(1)</script>'
    if (wrong === 'tooMany') c.state.feed.items = [1, 2, 3, 4].map(id => item(5, id))
    if (wrong === 'schema') c.state.feed = { items: [] }
    await c.open(); await waitFor(() => pending(c).length === 1); await tick(c)
    assert.equal(await panel(c).count(), 0); assert.equal(receipts(c).length, 0)
    assert.ok(await c.page.locator('.logout-action').count()); await c.close(); cases += 1
  }
  for (const error of [{ status: 404, code: 'NotFound' }, { status: 401, code: 'SessionInvalid' }, { status: 403, code: 'AccessDenied' }, { status: 401, code: 'StaffProfileInactive' }, { status: 429, code: 'TooManyRequests' }]) {
    const c = await setup(); c.state.pendingError = error; await c.open(); await waitFor(() => pending(c).length === 1); await tick(c)
    assert.equal(await panel(c).count(), 0); assert.ok(await c.page.locator('.logout-action').count())
    await c.page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')) }); await tick(c)
    assert.equal(pending(c).length, 1, 'Optional failures are quiet for this login')
    await c.close(); cases += 1
  }
  for (const outcome of ['409', 'unknown', '401', '403']) {
    const c = await setup(); if (outcome === 'unknown') c.state.ackStatus = 200; else c.state.ackError = { status: Number(outcome), code: outcome === '409' ? 'AnnouncementChanged' : 'AccessDenied' }
    await c.open(); await panel(c).waitFor(); await panel(c).getByRole('button', { name: c.t('next'), exact: true }).click()
    await panel(c).waitFor({ state: 'detached' }); assert.equal(receipts(c).length, 1); assert.equal(c.shared.seen.size, 0)
    assert.ok(await c.page.locator('.logout-action').count()); await c.close(); cases += 1
  }
  for (const operation of ['get', 'ack']) {
    const c = await setup({ role: 3, profiles: [{ restaurantId: 1, restaurantName: 'Restaurant A', roleId: 3, isActive: true }, { restaurantId: 2, restaurantName: 'Restaurant B', roleId: 3, isActive: true }] })
    const h = c.hold(r => operation === 'get' ? r.path.endsWith('/announcements/pending') : r.path.endsWith('/acknowledge'))
    await c.open()
    if (operation === 'ack') { await panel(c).waitFor(); await panel(c).getByRole('button', { name: c.t('next'), exact: true }).click() }
    await h.started.promise; await c.switchTo('Restaurant B'); await c.go('/notifications')
    await panel(c).waitFor(); assert.equal(await panel(c).getByRole('button', { name: c.t('next'), exact: true }).isEnabled(), true)
    if (operation === 'ack') await panel(c).getByText('Update 3/2', { exact: true }).waitFor()
    const next = c.hold(r => r.path.endsWith('/acknowledge') && r.restaurantId === 2)
    await panel(c).getByRole('button', { name: c.t('next'), exact: true }).click(); await next.started.promise
    h.release.resolve(); await h.released.promise; await tick(c)
    assert.equal(await panel(c).getByRole('button', { name: c.t('next'), exact: true }).isDisabled(), true, 'Old A completion cannot unlock B')
    next.release.resolve(); await panel(c).getByText(operation === 'ack' ? 'Update 3/3' : 'Update 3/2', { exact: true }).waitFor()
    await c.close(); cases += 1
  }
  {
    const shared = { seen: new Set() }, a = await setup({ shared }); await a.open(); await panel(a).waitFor()
    await panel(a).getByRole('button', { name: a.t('dismiss'), exact: true }).click(); await panel(a).waitFor({ state: 'detached' })
    const b = await setup({ shared }); await b.open(); await panel(b).getByText('Update 5/2', { exact: true }).waitFor()
    await a.close(); await b.close(); cases += 1
  }
  for (const role of [2, 3, 4, 5, 6]) {
    const c = await setup({ role }); await c.open('/admin/announcements'); await tick(c)
    assert.equal(c.state.requests.filter(r => r.path.startsWith('/api/v1/admin/announcements')).length, 0)
    assert.equal(await c.page.locator('a[href="/admin/announcements"]').count(), 0)
    await c.close(); cases += 1
  }
  for (const language of ['az', 'en', 'ru']) {
    const c = await setup({ role: 1, language }); await c.open('/admin/announcements')
    await c.page.getByRole('button', { name: c.t('edit'), exact: true }).click()
    const form = c.page.locator('.announcement-editor')
    for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      await c.page.setViewportSize({ width, height: 900 }); await c.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
      assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await c.page.screenshot({ path: path.join(dist, `announcement-admin-${language}-${width}-${theme}.png`), animations: 'disabled', fullPage: true })
    }
    await form.locator('input[maxlength="120"]').fill('Updated AZ')
    assert.equal(await form.getByRole('button', { name: c.t('publish'), exact: true }).isDisabled(), true)
    await form.getByRole('button', { name: c.t('saveDraft'), exact: true }).click()
    await c.page.getByText(c.t('version').replace('{{version}}', '2'), { exact: true }).waitFor()
    await form.getByRole('button', { name: c.t('publish'), exact: true }).click(); await c.page.locator('.confirm-dialog .ui-button-primary').click()
    await form.getByRole('button', { name: c.t('unpublish'), exact: true }).waitFor()
    assert.equal(await form.locator('input[maxlength="120"]').isDisabled(), true)
    await form.getByRole('button', { name: c.t('unpublish'), exact: true }).click(); await c.page.locator('.confirm-dialog .ui-button-danger').click()
    await form.getByRole('button', { name: c.t('saveDraft'), exact: true }).waitFor()
    const writes = c.state.requests.filter(r => r.path.startsWith('/api/v1/admin/announcements/') && r.method !== 'GET')
    assert.deepEqual(writes.map(r => JSON.parse(r.body).expectedVersion), [1, 2, 2])
    await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 1 }); await c.open('/admin/announcements'); await c.page.getByRole('button', { name: c.t('new'), exact: true }).click()
    await c.page.locator('.announcement-editor').getByRole('button', { name: c.t('saveDraft'), exact: true }).click()
    await c.page.getByText(c.t('saved'), { exact: true }).waitFor()
    const saved = c.state.requests.find(r => r.path === '/api/v1/admin/announcements' && r.method === 'POST')
    assert.equal(JSON.parse(saved.body).texts.every(t => t.title === '' && t.body === ''), true, 'Incomplete drafts may be saved')
    await c.page.getByRole('button', { name: c.t('publish'), exact: true }).click(); await c.page.locator('.confirm-dialog .ui-button-primary').click()
    await c.page.getByText(c.t('required'), { exact: true }).waitFor()
    assert.equal(c.state.requests.some(r => r.path.endsWith('/publish')), false)
    await c.close(); cases += 1
  }
  for (const code of ['AnnouncementChanged', 5202, 'AnnouncementMustBeDraft', 5203]) {
    const c = await setup({ role: 1 }); await c.open('/admin/announcements'); await c.page.getByRole('button', { name: c.t('edit'), exact: true }).click()
    c.state.rows[0].version = 2; c.state.adminError = { code, status: 409 }
    await c.page.locator('.announcement-editor input[maxlength="120"]').fill('Stale edit')
    await c.page.getByRole('button', { name: c.t('saveDraft'), exact: true }).click()
    await c.page.getByRole('button', { name: c.t('reloadLatest'), exact: true }).click()
    assert.equal(await c.page.locator('.announcement-editor input[maxlength="120"]').inputValue(), 'Draft az')
    await c.close(); cases += 1
  }
  for (const error of [{ code: 5200, status: 404, key: 'notFound' }, { code: 5201, status: 400, key: 'invalid' }, { code: 'AccessDenied', status: 403, key: 'denied' }, { code: 'TooManyRequests', status: 429, key: 'rateLimited' }]) {
    const c = await setup({ role: 1 }); await c.open('/admin/announcements'); await c.page.getByRole('button', { name: c.t('edit'), exact: true }).click()
    c.state.adminError = error
    await c.page.getByRole('button', { name: c.t('saveDraft'), exact: true }).click()
    await c.page.getByText(c.t(error.key), { exact: true }).waitFor()
    assert.ok(await c.page.locator('.logout-action').count())
    assert.equal(await c.page.getByRole('button', { name: c.t('saveDraft'), exact: true }).isEnabled(), true)
    await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 2, profiles: [{ restaurantId: 1, restaurantName: 'Restaurant A', roleId: 2, isActive: true }, { restaurantId: 2, restaurantName: 'Restaurant B', roleId: 2, isActive: true }] })
    await c.open(); await panel(c).waitFor(); await panel(c).getByRole('button', { name: c.t('open'), exact: true }).click()
    await c.page.waitForURL(url => url.pathname === '/admin' && url.searchParams.get('view') === 'reports')
    await c.page.locator('#role-dashboard-tab-reports[aria-selected="true"]').waitFor()
    const reportsUrl = new URL(c.page.url())
    await c.page.locator('#role-dashboard-tab-overview').click()
    await c.page.locator('#role-dashboard-tab-overview[aria-selected="true"]').waitFor()
    await c.go(reportsUrl.pathname + reportsUrl.search)
    await c.page.locator('#role-dashboard-tab-reports[aria-selected="true"]').waitFor()
    await c.switchTo('Restaurant B'); await c.page.locator('#role-dashboard-tab-overview[aria-selected="true"]').waitFor()
    await c.go('/admin?view=not-a-tab'); await c.page.locator('#role-dashboard-tab-overview[aria-selected="true"]').waitFor()
    await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 1 }); c.state.hasMore = true; c.state.next = 9
    await c.open('/admin/announcements'); await c.page.getByRole('button', { name: c.t('older'), exact: true }).click()
    await c.page.getByText('Older en', { exact: true }).waitFor()
    assert.ok(c.state.requests.some(r => r.url.endsWith('/admin/announcements?beforeId=9')))
    await c.page.getByRole('button', { name: c.t('refresh'), exact: true }).click()
    await c.page.getByText('Draft en', { exact: true }).waitFor()
    await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 1 }); const h = c.hold(r => r.path === '/api/v1/profile')
    await c.open('/admin/announcements'); await h.started.promise
    assert.equal(c.state.requests.some(r => r.path.startsWith('/api/v1/admin/announcements')), false)
    h.release.resolve(); await c.page.getByText('Draft en', { exact: true }).waitFor()
    await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 1 }); c.state.capabilities = [{ key: 'https://evil.test', roleIds: [1] }]
    await c.open('/admin/announcements'); await c.page.getByText(c.t('failed'), { exact: true }).waitFor()
    assert.equal(await c.page.getByRole('button', { name: c.t('new'), exact: true }).isDisabled(), true)
    await c.close(); cases += 1
  }
  for (const operation of ['get', 'ack']) {
    const c = await setup(); if (operation === 'get') c.state.pendingError = { code: 'SessionInvalid', status: 401 }; else c.state.ackError = { code: 'StaffProfileInactive', status: 401 }
    const h = c.hold(r => operation === 'get' ? r.path.endsWith('/announcements/pending') : r.path.endsWith('/acknowledge'))
    await c.open(); if (operation === 'ack') { await panel(c).waitFor(); await panel(c).getByRole('button', { name: c.t('next'), exact: true }).click() }
    await h.started.promise; c.state.pendingError = null; c.state.ackError = null
    await c.go('/login'); await c.page.locator('input[type=email]').fill('fresh@example.com'); await c.page.locator('input[type=password]').fill('FreshPassword1!'); await c.page.locator('.auth-card button[type=submit]').click()
    await c.page.locator('.user-pill strong').filter({ hasText: 'Fresh' }).waitFor(); await c.go('/notifications'); await panel(c).waitFor()
    h.release.resolve(); await h.released.promise; await tick(c)
    assert.ok(await c.page.locator('.logout-action').count()); assert.ok(await panel(c).count())
    await c.close(); cases += 1
  }
  {
    const shared = { seen: new Set(), catalog: [adminItem()] }, admin = await setup({ role: 1, shared })
    await admin.open('/admin/announcements'); await admin.page.getByRole('button', { name: admin.t('edit'), exact: true }).click()
    const publish = async () => { await admin.page.getByRole('button', { name: admin.t('publish'), exact: true }).click(); await admin.page.locator('.confirm-dialog .ui-button-primary').click(); await admin.page.getByRole('button', { name: admin.t('unpublish'), exact: true }).waitFor() }
    const unpublish = async () => { await admin.page.getByRole('button', { name: admin.t('unpublish'), exact: true }).click(); await admin.page.locator('.confirm-dialog .ui-button-danger').click(); await admin.page.getByRole('button', { name: admin.t('saveDraft'), exact: true }).waitFor() }
    await publish()
    const first = await setup({ shared }); await first.open(); await panel(first).getByText('Draft en', { exact: true }).waitFor(); await panel(first).getByRole('button', { name: first.t('dismiss'), exact: true }).click(); await panel(first).waitFor({ state: 'detached' }); await first.close()
    await unpublish(); await publish()
    const unchanged = await setup({ shared }); await unchanged.open(); await waitFor(() => pending(unchanged).length === 1); await tick(unchanged); assert.equal(await panel(unchanged).count(), 0); await unchanged.close()
    await unpublish(); await admin.page.locator('.announcement-editor input[maxlength="120"]').fill('New version AZ'); await admin.page.getByRole('button', { name: admin.t('saveDraft'), exact: true }).click(); await admin.page.getByText(admin.t('version').replace('{{version}}', '2'), { exact: true }).waitFor(); await publish()
    const second = await setup({ shared }); await second.open(); await panel(second).waitFor(); assert.equal(shared.catalog[0].version, 2)
    await second.close(); await admin.close(); cases += 1
  }
  assert.deepEqual(errors, [])
  console.log(`PASS ${cases} announcement browser scenarios: roles1-6, actual header role, verified/profile chooser gating, nonmodal/deferral, 3-card receipts, mixed rollout/errors, scope races, cross-device seen, admin guards/drafts/publish/version conflicts and AZ/EN/RU desktop/mobile/light/dark`)
} finally { await browser.close() }
