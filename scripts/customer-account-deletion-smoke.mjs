import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://ecafe.test', dist = path.resolve('dist'), secret = 'self-delete-test-password-no-storage'
const api = '/api/v1/profile/account-deletion'
const languages = ['az', 'en', 'ru']
const catalogs = Object.fromEntries(languages.map(language => [language, JSON.parse(fs.readFileSync(`src/shared/i18n/catalog/${language}.json`, 'utf8'))]))
const handoff = JSON.parse(fs.readFileSync('docs/customer-self-account-deletion-ui-messages.json', 'utf8'))
for (const language of languages) assert.deepEqual(handoff[language], Object.fromEntries(Object.entries(catalogs[language]).filter(([key]) => key.startsWith('ui.accountDeletion.'))))
const blockers = { ActiveStaffProfile: 'activeStaff', ActiveReservation: 'activeReservation', OpenTableSession: 'openSession', PendingPayment: 'pendingPayment', PendingRefund: 'pendingRefund', UnpaidBill: 'unpaidBill', WalletBalance: 'walletBalance', UnresolvedOrder: 'unresolvedOrder' }
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const pageErrors = []
let cases = 0
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const waitFor = async check => { const until = Date.now() + 10000; while (!check()) { assert.ok(Date.now() < until, 'Mock state not reached'); await new Promise(resolve => setTimeout(resolve, 10)) } }
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
const problem = (route, code, status) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message: 'Untrusted provider message - must not display' }) })

async function setup({ language = 'en', role = 5, tokenRole = role, profiles = [1, 5].includes(role) ? [] : [{ restaurantId: 1, restaurantName: 'Restaurant A', roleId: role, isActive: true }] } = {}) {
  const state = { requests: [], sockets: [], holds: [], cookieUser: '42', loginUser: '84', eligibility: { canDelete: true, blockers: [] }, checkError: null, postError: null, postNetwork: false, checkNetwork: false, closed: false, expireNotifications: false, blockerAfterPost: null }
  const profile = id => ({ userId: id, name: id === '84' ? 'Fresh' : 'Current', surname: 'Customer', email: `user${id}@example.com`, phone: '+994501234567', roleId: id === '84' ? 5 : role, isActive: true, profiles: id === '84' ? [] : profiles })
  const jwt = id => `header.${Buffer.from(JSON.stringify({ ...profile(id), roleId: String(id === '84' ? 5 : tokenRole), restaurantId: profiles.find(p => p.isActive)?.restaurantId, restaurantIds: profiles.filter(p => p.isActive).map(p => String(p.restaurantId)), restaurantRoles: profiles.filter(p => p.isActive).map(p => `${p.restaurantId}:${p.roleId}`), permissions: [] })).toString('base64url')}.signature`
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.addInitScript(language => {
    localStorage.setItem('ecafe.language', language)
    window.__storageWrites = []; window.__unhandled = []
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { window.__storageWrites.push(`${key}:${value}`); return set.call(this, key, value) }
    window.addEventListener('unhandledrejection', e => window.__unhandled.push(String(e.reason)))
    window.__identity = Math.random()
  }, language)
  const page = await context.newPage()
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', message => assert.ok(!message.text().includes(secret), 'Password not logged'))
  await page.routeWebSocket('**/hubs/user-events*', socket => {
    const connection = { socket, ready: false, closed: false }; state.sockets.push(connection)
    socket.onMessage(message => { for (const part of message.toString().split('\x1e').filter(Boolean)) if (JSON.parse(part).protocol) { socket.send('{}\x1e'); connection.ready = true } })
    socket.onClose(() => { connection.closed = true })
  })
  const ping = setInterval(() => { for (const c of state.sockets) if (c.ready && !c.closed) { try { c.socket.send('{"type":6}\x1e') } catch {} } }, 5000)
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname
    assert.ok(!req.url().includes(secret), 'Password not placed in URL')
    if (url.origin !== origin) return route.abort()
    if (p === '/hubs/user-events/negotiate') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ negotiateVersion: 1, connectionId: 'test', connectionToken: 'test', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] }) })
    if (p.startsWith('/api/v1/')) {
      let id = state.cookieUser
      try { id = String(JSON.parse(Buffer.from(req.headers().authorization.split('.')[1], 'base64url').toString()).userId) } catch {}
      const record = { path: p, method: req.method(), body: req.postData(), headers: req.headers(), id }
      state.requests.push(record)
      const held = state.holds.find(h => !h.used && h.match(record))
      const snapshot = profile(id), token = jwt(state.cookieUser), eligibility = structuredClone(state.eligibility)
      const checkError = state.checkError, postError = state.postError
      if (held) { held.used = true; held.started.resolve(); await held.release.promise; held.released.resolve() }
      if (p === '/api/v1/user/refresh') return state.closed && state.cookieUser === '42' && !held ? problem(route, 'SessionInvalid', 401) : json(route, { accessToken: token })
      if (p === '/api/v1/user/login') { state.cookieUser = state.loginUser; return json(route, { accessToken: jwt(state.loginUser) }) }
      if (p === '/api/v1/profile') return json(route, snapshot)
      if (p === api) {
        if (req.method() === 'GET') {
          if (state.checkNetwork) return route.abort('failed')
          if (checkError) return problem(route, checkError.code, checkError.status)
          return json(route, eligibility)
        }
        if (state.postNetwork) return route.abort('failed')
        if (postError) { if (state.blockerAfterPost) state.eligibility = { canDelete: false, blockers: state.blockerAfterPost }; return problem(route, postError.code, postError.status) }
        if (state.postStatus) return route.fulfill({ status: state.postStatus, contentType: 'application/json', body: JSON.stringify({ data: null }) })
        state.closed = true
        return route.fulfill({ status: 204 })
      }
      if (p.includes('localization/dictionaries')) return json(route, { language, version: 'test', fallbackLanguage: 'az', messages: {} })
      if (p.includes('localization/preference')) return json(route, { language })
      if (p === '/api/v1/notifications' || p.endsWith('/unread-count')) {
        if (state.expireNotifications) return problem(route, 'SessionExpired', 401)
        return json(route, p.endsWith('/unread-count') ? { count: 0 } : [])
      }
      if (p.includes('/user/sessions')) return json(route, [])
      if (p.includes('/user/logout')) return route.fulfill({ status: 204 })
      return json(route, {})
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  const t = key => catalogs[language][`ui.accountDeletion.${key}`]
  return {
    page, context, state, t,
    async open() { await page.goto(origin + '/account'); await page.locator('.profile-account-form').waitFor(); await waitFor(() => state.sockets.some(c => c.ready)); },
    async go(route) { await page.evaluate(route => { history.pushState({}, '', route); dispatchEvent(new PopStateEvent('popstate')) }, route) },
    async dialog() { await page.locator('.account-deletion-section button').click(); const dialog = page.locator('dialog.account-deletion-dialog'); await dialog.waitFor(); return dialog },
    hold(match) { const h = { match, used: false, started: deferred(), release: deferred(), released: deferred() }; state.holds.push(h); return h },
    event(target, payload) { state.sockets.filter(c => c.ready && !c.closed).at(-1).socket.send(JSON.stringify({ type: 1, target, arguments: [payload] }) + '\x1e') },
    async close() {
      const browserState = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, writes: window.__storageWrites, history: history.state, url: location.href }))
      assert.ok(!browserState.includes(secret), 'Password absent from storage/history/URL')
      assert.deepEqual(await page.evaluate(() => window.__unhandled), [])
      clearInterval(ping); await context.close()
    },
  }
}
async function fill(dialog) { await dialog.locator('input[type=password]').fill(secret); await dialog.locator('input[type=checkbox]').check() }
async function submit(dialog) { await fill(dialog); await dialog.locator('button[type=submit]').click() }
const posts = c => c.state.requests.filter(r => r.path === api && r.method === 'POST')
const checks = c => c.state.requests.filter(r => r.path === api && r.method === 'GET')
async function screenshots(c, dialog, state) {
  for (const width of [1440, 390, 320]) {
    await c.page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      await c.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
      const box = await dialog.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 901)
      assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await c.page.screenshot({ animations: 'disabled', path: path.join(dist, `account-deletion-${state}-${await c.page.evaluate(() => localStorage.getItem('ecafe.language'))}-${width}-${theme}.png`) })
    }
  }
}

try {
  for (const language of languages) {
    const c = await setup({ language }); await c.open()
    assert.equal(checks(c).length, 0, 'No deletion preflight until explicit intent')
    const dialog = await c.dialog()
    await dialog.locator('input[type=password]').waitFor()
    assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true)
    await dialog.locator('input[type=password]').fill(secret)
    assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true, 'Explicit irreversible confirmation is required')
    await dialog.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(posts(c).length, 0, 'DOM tampering cannot bypass the confirmation state')
    await dialog.locator('input[type=checkbox]').check()
    await dialog.getByText(c.t('description'), { exact: true }).waitFor()
    await screenshots(c, dialog, 'ready')
    const held = c.hold(r => r.path === api && r.method === 'POST')
    await dialog.locator('button[type=submit]').click(); await held.started.promise
    await dialog.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await c.page.keyboard.press('Escape')
    assert.equal(await dialog.isVisible(), true)
    assert.equal(await dialog.locator('input[type=password]').inputValue(), '')
    assert.equal(posts(c).length, 1)
    assert.deepEqual(JSON.parse(posts(c)[0].body), { currentPassword: secret, confirm: true })
    held.release.resolve()
    await c.page.waitForURL(origin + '/login')
    await c.page.locator('.auth-card .form-message-success').filter({ hasText: c.t('completed') }).waitFor()
    assert.equal(await c.page.locator('.logout-action').count(), 0)
    assert.equal(await c.page.evaluate(() => Boolean(localStorage.getItem('ecafe.manualLogoutAt'))), true)
    assert.equal(c.state.requests.filter(r => r.path.includes('/logout')).length, 0, 'No redundant logout API after successful deletion')
    assert.equal(await c.page.locator('.session-termination-notice').count(), 0, 'Login has one inline reason')
    await c.page.screenshot({ animations: 'disabled', path: path.join(dist, `account-deletion-completed-${language}-320-dark.png`) })
    await c.close(); cases += 1

    const blocked = await setup({ language }); blocked.state.eligibility = { canDelete: false, blockers: Object.keys(blockers) }
    await blocked.open(); const blockedDialog = await blocked.dialog()
    for (const key of Object.values(blockers)) await blockedDialog.getByText(blocked.t(key), { exact: true }).waitFor()
    assert.equal(await blockedDialog.locator('input[type=password]').count(), 0)
    assert.equal(await blockedDialog.locator('button[type=submit]').isDisabled(), true)
    await screenshots(blocked, blockedDialog, 'blocked')
    assert.equal(posts(blocked).length, 0)
    await blocked.close(); cases += 1
  }
  for (const role of [1, 2, 3, 4, 6]) {
    const c = await setup({ role }); await c.open()
    assert.equal(await c.page.locator('.account-deletion-section').count(), 0)
    assert.equal(checks(c).length, 0); await c.close(); cases += 1
  }
  for (const staffRole of [2, 3, 4, 6]) {
    const c = await setup({ profiles: [{ restaurantId: 1, roleId: staffRole, isActive: true }] }); await c.open()
    assert.equal(await c.page.locator('.account-deletion-section').count(), 0)
    assert.equal(checks(c).length, 0); await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 2, tokenRole: 5 }); await c.open()
    assert.equal(await c.page.locator('.account-deletion-section').count(), 0, 'A legacy customer JWT does not override the profile account role')
    assert.equal(checks(c).length, 0); await c.close(); cases += 1
  }
  {
    const c = await setup({ profiles: [{ restaurantId: 1, roleId: 3, isActive: false }] }); await c.open()
    const dialog = await c.dialog(); await dialog.locator('input[type=password]').waitFor()
    await c.close(); cases += 1
  }
  for (const [blocker, key] of Object.entries(blockers)) {
    const c = await setup(); c.state.eligibility = { canDelete: false, blockers: [blocker] }
    await c.open(); const dialog = await c.dialog()
    await dialog.getByText(c.t(key), { exact: true }).waitFor()
    assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true)
    c.state.eligibility = { canDelete: true, blockers: [] }
    await dialog.getByRole('button', { name: c.t('recheck'), exact: true }).click()
    await dialog.locator('input[type=password]').waitFor()
    assert.equal(posts(c).length, 0); await c.close(); cases += 1
  }
  for (const value of [null, { canDelete: 'true', blockers: [] }, { canDelete: true }, { canDelete: true, blockers: ['UnknownNewBlocker'] }, { canDelete: false, blockers: [] }]) {
    const c = await setup(); c.state.eligibility = value; await c.open(); const dialog = await c.dialog()
    await dialog.getByText(c.t(value && typeof value.canDelete === 'boolean' && Array.isArray(value.blockers) ? 'unknownBlocker' : 'checkFailed'), { exact: true }).waitFor()
    assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true)
    assert.equal(posts(c).length, 0); await c.close(); cases += 1
  }
  for (const error of [{ code: 'AccountDeletionCustomerOnly', status: 403 }, { code: 1142, status: 403 }, { code: 'Failure', status: 500 }, 'network']) {
    const c = await setup(); if (error === 'network') c.state.checkNetwork = true; else c.state.checkError = error
    await c.open(); const dialog = await c.dialog()
    await dialog.getByText(c.t(error.status === 403 ? 'customerOnly' : 'checkFailed'), { exact: true }).waitFor()
    assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true)
    c.state.checkError = null; c.state.checkNetwork = false
    await dialog.getByRole('button', { name: c.t('recheck'), exact: true }).click()
    await dialog.locator('input[type=password]').waitFor(); await c.close(); cases += 1
  }
  for (const error of [{ code: 'InvalidCredentials', status: 400, key: 'invalidPassword' }, { code: 'InvalidCredentials', status: 401, key: 'invalidPassword' }, { code: 'AccountTemporarilyLocked', status: 400, key: 'locked' }, { code: 'TooManyRequests', status: 429, key: 'rateLimited' }, { code: 'AccountDeletionCustomerOnly', status: 403, key: 'customerOnly' }, { code: 1142, status: 403, key: 'customerOnly' }, { code: 'Failure', status: 500, key: 'failed' }, { code: 'network', status: 0, key: 'failed' }]) {
    const c = await setup(); c.state.postError = error; c.state.postNetwork = error.code === 'network'
    await c.open(); const dialog = await c.dialog(); await submit(dialog)
    await dialog.getByText(c.t(error.key), { exact: true }).waitFor()
    if (await dialog.locator('input[type=password]').count()) assert.equal(await dialog.locator('input[type=password]').inputValue(), '')
    assert.equal(posts(c).length, 1)
    assert.equal(c.state.requests.filter(r => r.path === '/api/v1/user/refresh').length, 1, 'Deletion never auto-replays through refresh')
    assert.ok(await c.page.locator('.logout-action').count(), 'Bad password is not a global session failure')
    if (['locked', 'rateLimited'].includes(error.key)) {
      await dialog.locator('footer .ui-button-secondary').click()
      const reopened = await c.dialog(); await fill(reopened)
      assert.equal(await reopened.locator('button[type=submit]').isDisabled(), true, 'Cooldown survives reopening')
    }
    if (['invalidPassword', 'failed'].includes(error.key)) {
      c.state.postError = null; c.state.postNetwork = false
      await submit(dialog); await c.page.waitForURL(origin + '/login')
      await c.page.getByText(c.t('completed'), { exact: true }).waitFor()
      assert.equal(posts(c).length, 2, 'Retry requires fresh password and explicit consent')
    }
    await c.close(); cases += 1
  }
  for (const code of ['AccountDeletionBlocked', 1143]) {
    const c = await setup(); c.state.postError = { code, status: 409 }; c.state.blockerAfterPost = ['PendingRefund']
    await c.open(); const dialog = await c.dialog(); await submit(dialog)
    await dialog.getByText(c.t('pendingRefund'), { exact: true }).waitFor()
    await dialog.getByText(c.t('changed'), { exact: true }).waitFor()
    assert.equal(checks(c).length, 2, 'POST409 reloads advisory eligibility')
    assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true)
    c.state.postError = null; c.state.blockerAfterPost = null; c.state.eligibility = { canDelete: true, blockers: [] }
    await dialog.getByRole('button', { name: c.t('recheck'), exact: true }).click()
    await submit(dialog); await c.page.waitForURL(origin + '/login')
    await c.page.getByText(c.t('completed'), { exact: true }).waitFor(); await c.close(); cases += 1
  }
  {
    const c = await setup(); c.state.postError = { code: 'SessionInvalid', status: 401 }
    await c.open(); const dialog = await c.dialog(); await submit(dialog)
    await dialog.getByText(c.t('sessionExpired'), { exact: true }).waitFor()
    await dialog.getByRole('link', { name: c.t('login'), exact: true }).click()
    await c.page.waitForURL(origin + '/login')
    assert.equal(await c.page.locator('.logout-action').count(), 0); await c.close(); cases += 1
  }
  {
    const c = await setup(); c.state.postStatus = 200
    await c.open(); const dialog = await c.dialog(); await submit(dialog)
    await dialog.getByText(c.t('failed'), { exact: true }).waitFor()
    assert.ok(await c.page.locator('.logout-action').count(), 'Only confirmed204 completes local deletion')
    await c.close(); cases += 1
  }
  {
    const c = await setup(); await c.open()
    const held = c.hold(r => r.path === api && r.method === 'GET')
    const dialog = await c.dialog(); await held.started.promise
    await dialog.getByRole('button', { name: catalogs.en['ui.common.close'], exact: true }).click()
    await dialog.waitFor({ state: 'detached' })
    c.state.eligibility = { canDelete: false, blockers: ['UnpaidBill'] }
    const reopened = await c.dialog(); await reopened.getByText(c.t('unpaidBill'), { exact: true }).waitFor()
    held.release.resolve(); await held.released.promise
    await c.page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(await reopened.locator('input[type=password]').count(), 0, 'A stale eligible check cannot enable the reopened blocked dialog')
    assert.equal(await reopened.locator('button[type=submit]').isDisabled(), true)
    await c.close(); cases += 1
  }
  for (const earlyEvent of [false, true]) {
    const c = await setup(); await c.open(); const dialog = await c.dialog()
    const held = c.hold(r => r.path === api && r.method === 'POST')
    await submit(dialog); await held.started.promise
    if (earlyEvent) {
      c.event('UserDeactivated', { message: c.t('completed') })
      await c.page.waitForURL(origin + '/login')
      await c.page.locator('.auth-card .form-message-success').filter({ hasText: c.t('completed') }).waitFor()
    } else await c.go('/login')
    await c.page.locator('input[type=email]').fill('fresh@example.com')
    await c.page.locator('input[type=password]').fill('FreshPassword1!')
    await c.page.locator('.auth-card button[type=submit]').click()
    await c.page.locator('.user-pill strong').filter({ hasText: 'Fresh' }).waitFor()
    const expectedUrl = c.page.url()
    held.release.resolve(); await held.released.promise
    await c.page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(c.page.url(), expectedUrl)
    assert.ok(await c.page.locator('.logout-action').count())
    assert.equal(await c.page.evaluate(() => localStorage.getItem('ecafe.manualLogoutAt')), null)
    await c.close(); cases += 1
  }
  {
    const c = await setup(); await c.open(); const dialog = await c.dialog()
    const held = c.hold(r => r.path === '/api/v1/profile')
    await c.page.evaluate(() => window.dispatchEvent(new Event('focus'))); await held.started.promise
    await submit(dialog); await c.page.waitForURL(origin + '/login')
    held.release.resolve(); await held.released.promise
    await c.page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(await c.page.locator('.logout-action').count(), 0)
    await c.page.getByText(c.t('completed'), { exact: true }).waitFor(); await c.close(); cases += 1
  }
  {
    const c = await setup(); await c.open(); const dialog = await c.dialog(); await dialog.locator('input[type=password]').waitFor()
    const held = c.hold(r => r.path === '/api/v1/user/refresh')
    c.state.expireNotifications = true
    await c.page.evaluate(() => window.dispatchEvent(new Event('ecafe:notifications-refresh'))); await held.started.promise
    await submit(dialog); await c.page.waitForURL(origin + '/login')
    c.state.expireNotifications = false
    held.release.resolve(); await held.released.promise
    await c.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await c.page.locator('.logout-action').count(), 0)
    assert.equal(await c.page.evaluate(() => Boolean(localStorage.getItem('ecafe.manualLogoutAt'))), true)
    await c.page.getByText(c.t('completed'), { exact: true }).waitFor(); await c.close(); cases += 1
  }
  assert.deepEqual(pageErrors, [])
  console.log(`PASS ${cases} customer account-deletion scenarios: customer/staff/admin boundaries, 8 blockers, fail-closed preflight, password/confirmation, lockout/rate/session/409/network, single POST, successful local logout, early realtime, stale new-login/profile/refresh races, no secret leaks and AZ/EN/RU desktop/mobile/light/dark`)
} finally { await browser.close() }
