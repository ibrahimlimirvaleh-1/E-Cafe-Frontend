import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://ecafe.test', dist = path.resolve('dist')
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map(language => [language, JSON.parse(fs.readFileSync(`src/shared/i18n/catalog/${language}.json`, 'utf8'))]))
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const errors = [], defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
let cases = 0
const waitFor = async check => { const end = Date.now() + 10000; while (!check()) { assert.ok(Date.now() < end, 'Mock state not reached'); await new Promise(r => setTimeout(r, 10)) } }
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
async function setup({ role = 5, language = 'en', count = 47 } = {}) {
  const state = { ids: Array.from({ length: count }, (_, i) => count - i), read: new Set(), requests: [], holds: [], sockets: [], error: 0, previewError: 0, postError: 0, duplicate: false, denied: new Set(), user: '42' }
  const profiles = [1, 5].includes(role) ? [] : [1, 2].map(restaurantId => ({ restaurantId, restaurantName: `Restaurant ${restaurantId}`, roleId: role, isActive: true }))
  const profile = id => ({ userId: id, name: id === '84' ? 'Fresh' : 'Current', surname: 'User', email: `user${id}@example.com`, roleId: id === '84' ? 5 : role, isActive: true, profiles: id === '84' ? [] : profiles })
  const jwt = id => `header.${Buffer.from(JSON.stringify({ ...profile(id), roleId: String(id === '84' ? 5 : role), restaurantId: profiles[0]?.restaurantId, restaurantIds: profiles.map(p => String(p.restaurantId)), restaurantRoles: profiles.map(p => `${p.restaurantId}:${p.roleId}`), permissions: [] })).toString('base64url')}.signature`
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ language, role, profiles }) => {
    localStorage.setItem('ecafe.language', language)
    if (profiles.length) localStorage.setItem('ecafe.activeProfile.42', `1:${role}`)
    window.__unhandled = []; window.addEventListener('unhandledrejection', e => window.__unhandled.push(String(e.reason)))
  }, { language, role, profiles })
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
  await page.routeWebSocket('**/hubs/user-events*', socket => {
    const c = { socket, ready: false, closed: false }; state.sockets.push(c)
    socket.onMessage(m => { for (const p of m.toString().split('\x1e').filter(Boolean)) if (JSON.parse(p).protocol) { socket.send('{}\x1e'); c.ready = true } })
    socket.onClose(() => { c.closed = true })
  })
  const ping = setInterval(() => { for (const c of state.sockets) if (c.ready && !c.closed) { try { c.socket.send('{"type":6}\x1e') } catch {} } }, 5000)
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname
    if (url.origin !== origin) return route.abort()
    if (p === '/hubs/user-events/negotiate') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ negotiateVersion: 1, connectionId: 'fixture', connectionToken: 'fixture', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] }) })
    if (p.startsWith('/api/v1/')) {
      let uid = state.user; try { uid = String(JSON.parse(Buffer.from(req.headers().authorization.split('.')[1], 'base64url').toString()).userId) } catch {}
      const scope = req.headers()['x-active-restaurant-id'] || '', pageNumber = Number(url.searchParams.get('PageNumber') || 1), size = Number(url.searchParams.get('PageSize') || 20)
      const record = { path: p, method: req.method(), pageNumber, size, scope, uid, body: req.postData() }; state.requests.push(record)
      const hold = state.holds.find(h => !h.used && h.match(record)), key = `${uid}:${scope}`
      const data = state.ids.map(id => ({ id, title: `${uid === '84' ? 'Fresh' : scope || 'Global'} #${id}`, message: 'Reservation update with full details for the guest.', typeName: 'GenericNotice', isRead: state.read.has(`${key}:${id}`), restaurantId: scope ? Number(scope) : id % 2 + 1, createdAt: '2026-11-25T12:00:00Z' }))
      const totalPages = Math.ceil(data.length / size), items = structuredClone(data.slice((pageNumber - 1) * size, pageNumber * size)), unread = data.filter(n => !n.isRead).length
      if (state.duplicate && items.length > 1) items[1] = structuredClone(items[0])
      const responseError = size === 6 ? state.previewError : state.error, denied = state.denied.has(scope), snapshot = profile(uid)
      if (hold) { hold.used = true; hold.started.resolve(); await hold.release.promise; hold.released.resolve() }
      if (p === '/api/v1/user/refresh') return json(route, { accessToken: jwt(state.user) })
      if (p === '/api/v1/user/login') { state.user = '84'; return json(route, { accessToken: jwt(state.user) }) }
      if (p.includes('/user/logout')) return route.fulfill({ status: 204 })
      if (p === '/api/v1/profile') return json(route, snapshot)
      if (p.startsWith('/api/v1/notifications')) {
        if (denied) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'AccessDenied', message: 'Access denied' }) })
        if (p.endsWith('/unread-count')) return json(route, { count: unread })
        if (req.method() === 'POST') {
          if (state.postError) return route.fulfill({ status: state.postError, contentType: 'application/json', body: JSON.stringify({ message: 'Read failed' }) })
          if (p.endsWith('/read-all')) for (const n of data) state.read.add(`${key}:${n.id}`)
          else state.read.add(`${key}:${p.split('/').at(-2)}`)
          return route.fulfill({ status: 204 })
        }
        if (p.endsWith('/paged')) {
          if (responseError === 'network') return route.abort('failed')
          if (responseError) return route.fulfill({ status: responseError, contentType: 'application/json', body: JSON.stringify({ message: 'List unavailable' }) })
          return json(route, { items, pageIndex: pageNumber, totalPages, totalCount: data.length, hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber < totalPages })
        }
        return json(route, data)
      }
      if (p.includes('localization/dictionaries')) return json(route, { language, version: 'fixture', fallbackLanguage: 'az', messages: {} })
      if (p.includes('localization/preference')) return json(route, { language })
      return json(route, {})
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  return { state, page, context, t: key => catalogs[language][key],
    async open() { await page.goto(origin + '/notifications'); await page.locator('.user-pill').waitFor(); await waitFor(() => state.sockets.some(s => s.ready)); await page.locator('.realtime-indicator').waitFor({ state: 'detached' }); await page.locator('.notification-page-list[aria-busy=false]').waitFor({ state: 'attached' }) },
    async go(target) { await page.evaluate(target => { history.pushState({ key: String(Math.random()) }, '', target); dispatchEvent(new PopStateEvent('popstate')) }, target) },
    event() { state.sockets.filter(c => c.ready && !c.closed).at(-1).socket.send('{"type":1,"target":"NotificationsChanged","arguments":[]}\x1e') },
    async switchTo(id) { await page.locator('.user-profile-switcher summary').click(); await page.locator('.user-profile-option').filter({ hasText: `Restaurant ${id}` }).click(); await this.go('/notifications') },
    hold(match) { const h = { match, started: defer(), release: defer(), released: defer() }; state.holds.push(h); return h },
    async close() { assert.deepEqual(await page.evaluate(() => window.__unhandled), []); assert.equal(state.requests.filter(r => r.path === '/api/v1/notifications' && r.method === 'GET').length, 0, 'Never download the legacy history'); clearInterval(ping); await context.close() },
  }
}
const rows = c => c.page.locator('.notification-page-list > button')
const pager = c => c.page.locator('.pagination-row')
const active = (c, number) => pager(c).locator(`[aria-current=page]`).filter({ hasText: String(number) })
const readAll = c => c.page.getByRole('button', { name: c.t('ui.pages.customer.notifications_page.hamisini_oxunmus_et_cacc2d'), exact: true })
async function loaded(c, title = 'Global #47') { await rows(c).getByText(title, { exact: true }).waitFor() }
async function tick(c) { await c.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
try {
  for (const language of ['az', 'en', 'ru']) {
    const c = await setup({ language }); await c.open(); await loaded(c)
    assert.equal(await rows(c).count(), 20); assert.equal(await pager(c).locator('select').inputValue(), '20')
    if (language === 'az') assert.doesNotMatch(await rows(c).first().locator('time').innerText(), /\bM\d{1,2}\b/)
    await pager(c).getByRole('button', { name: '2', exact: true }).click(); await loaded(c, 'Global #27'); await active(c, 2).waitFor()
    await pager(c).getByRole('button', { name: '3', exact: true }).click(); await loaded(c, 'Global #7'); assert.equal(await rows(c).count(), 7)
    await pager(c).locator('select').selectOption('10'); await loaded(c); await active(c, 1).waitFor(); assert.equal(await rows(c).count(), 10)
    for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      await c.page.setViewportSize({ width, height: 900 }); await c.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
      assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await c.page.screenshot({ path: path.join(dist, `notifications-pagination-${language}-${width}-${theme}.png`), fullPage: true, animations: 'disabled' })
    }
    await c.page.locator('.notification-trigger').click(); await c.page.locator('.notification-list button').first().waitFor(); assert.equal(await c.page.locator('.notification-list button').count(), 6)
    assert.ok(c.state.requests.some(r => r.size === 6 && r.pageNumber === 1 && r.path.endsWith('/paged')))
    await c.page.keyboard.press('Escape'); await readAll(c).click(); await waitFor(() => c.state.read.size === 47); await tick(c)
    assert.equal(await readAll(c).isDisabled(), true); await active(c, 1).waitFor(); await c.close(); cases += 1
  }
  for (const failure of [500, 404, 'network']) {
    const c = await setup(); c.state.error = failure; await c.open(); await c.page.locator('.notification-page-feedback').waitFor(); await tick(c)
    c.state.error = 0; await c.page.getByRole('button', { name: c.t('ui.notifications.retry'), exact: true }).click(); await loaded(c)
    assert.equal(await c.page.locator('.notification-page-feedback').count(), 0); await c.close(); cases += 1
  }
  {
    const c = await setup(); await c.open(); await loaded(c); await pager(c).getByRole('button', { name: '2', exact: true }).click(); await loaded(c, 'Global #27')
    c.state.ids.unshift(48); const held = c.hold(r => r.path.endsWith('/paged') && r.size === 20 && r.pageNumber === 2)
    c.event(); await held.started.promise
    assert.equal(await rows(c).count(), 20); await active(c, 2).waitFor(); await loaded(c, 'Global #27')
    held.release.resolve(); await loaded(c, 'Global #28'); await active(c, 2).waitFor(); assert.equal(await rows(c).count(), 20)
    await pager(c).getByRole('button', { name: '1', exact: true }).click(); await loaded(c, 'Global #48')
    const titles = await rows(c).locator('strong').allTextContents(); assert.equal(new Set(titles).size, titles.length)
    await c.close(); cases += 1
  }
  for (const remaining of [8, 0]) {
    const c = await setup(); await c.open(); await loaded(c); await pager(c).getByRole('button', { name: '3', exact: true }).click(); await loaded(c, 'Global #7')
    c.state.ids = c.state.ids.slice(0, remaining); c.event()
    if (remaining) { await waitFor(() => c.state.requests.some(r => r.path.endsWith('/paged') && r.size === 20 && r.pageNumber === 1 && c.state.ids.length === 8)); await active(c, 1).waitFor(); assert.equal(await rows(c).count(), 8) }
    else { await c.page.getByText(c.t('ui.pages.customer.notifications_page.bildiris_yoxdur_68216b'), { exact: true }).waitFor(); assert.equal(await pager(c).count(), 0) }
    await c.close(); cases += 1
  }
  {
    const c = await setup(); c.state.duplicate = true; await c.open(); await loaded(c)
    const titles = await rows(c).locator('strong').allTextContents(); assert.equal(titles.length, 19); assert.equal(new Set(titles).size, titles.length)
    await c.close(); cases += 1
  }
  {
    const c = await setup(); for (const id of c.state.ids.slice(0, 20)) c.state.read.add(`42::${id}`)
    await c.open(); await loaded(c); assert.equal(await rows(c).locator('.ui-badge-warning').count(), 0); assert.equal(await readAll(c).isEnabled(), true, 'Global unread includes later pages')
    await readAll(c).click(); await waitFor(() => c.state.read.size === 47); await c.close(); cases += 1
  }
  {
    const c = await setup(); await c.open(); await loaded(c); c.state.postError = 500; await rows(c).first().click(); await c.page.locator('.notification-page-feedback').waitFor()
    assert.equal(c.state.read.size, 0); c.state.postError = 0; await rows(c).first().click(); await waitFor(() => c.state.read.size === 1)
    await rows(c).first().getByText(c.t('ui.pages.customer.notifications_page.oxunub_9285c6'), { exact: true }).waitFor()
    await rows(c).first().click(); await tick(c); assert.equal(c.state.requests.filter(r => r.method === 'POST' && r.path.endsWith('/read')).length, 2, 'Already-read does not POST again')
    await c.close(); cases += 1
  }
  for (const transition of ['profile', 'aba', 'new-login']) {
    const c = await setup({ role: 3 }); await c.open(); await loaded(c, '1 #47'); await pager(c).getByRole('button', { name: '2', exact: true }).click(); await loaded(c, '1 #27')
    const held = c.hold(r => r.path.endsWith('/paged') && r.size === 20 && r.pageNumber === 2 && r.scope === '1'); c.event(); await held.started.promise
    if (transition === 'new-login') {
      await c.go('/login'); await c.page.locator('input[type=email]').fill('fresh@example.com'); await c.page.locator('input[type=password]').fill('FreshPassword123!'); await c.page.locator('.auth-card button[type=submit]').click(); await c.page.locator('.user-pill strong').filter({ hasText: 'Fresh' }).waitFor(); await c.go('/notifications'); await loaded(c, 'Fresh #47')
    } else { await c.switchTo(2); await loaded(c, '2 #47'); if (transition === 'aba') { await c.switchTo(1); await loaded(c, '1 #47') } }
    held.release.resolve(); await held.released.promise; await tick(c); await active(c, 1).waitFor(); assert.equal(await rows(c).count(), 20)
    assert.equal(await rows(c).getByText('1 #27', { exact: true }).count(), 0); await c.close(); cases += 1
  }
  {
    const c = await setup({ role: 3 }); await c.open(); await loaded(c, '1 #47'); c.state.denied.add('1'); c.event(); await c.page.locator('.notification-page-feedback').waitFor()
    assert.equal(await rows(c).count(), 0); assert.equal(await pager(c).count(), 0); assert.ok(await c.page.locator('.logout-action').count())
    await c.switchTo(2); await loaded(c, '2 #47'); assert.equal(await c.page.locator('.notification-page-feedback').count(), 0); await c.close(); cases += 1
  }
  {
    const c = await setup({ count: 0 }); await c.open(); await c.page.getByText(c.t('ui.pages.customer.notifications_page.bildiris_yoxdur_68216b'), { exact: true }).waitFor(); assert.equal(await pager(c).count(), 0); assert.equal(await readAll(c).isDisabled(), true); await c.close(); cases += 1
  }
  {
    const c = await setup(); c.state.previewError = 500; await c.open(); await loaded(c); await c.page.locator('.notification-trigger').click(); await c.page.locator('.notification-popover .form-message-danger').waitFor()
    c.state.previewError = 0; await c.page.locator('.notification-popover').getByRole('button', { name: c.t('ui.notifications.retry'), exact: true }).click(); await c.page.locator('.notification-list button').first().waitFor(); assert.equal(await c.page.locator('.notification-list button').count(), 6)
    await c.page.locator('.notification-popover header button').click(); await waitFor(() => c.state.read.size === 47); await c.page.keyboard.press('Escape'); await waitFor(() => c.state.requests.filter(r => r.path.endsWith('/paged') && r.size === 20).length >= 2); await tick(c); assert.equal(await readAll(c).isDisabled(), true)
    await c.close(); cases += 1
  }
  for (const role of [1, 2, 3, 4, 5, 6]) {
    const c = await setup({ role }); await c.open(); await loaded(c, `${[1, 5].includes(role) ? 'Global' : '1'} #47`)
    assert.ok(c.state.requests.filter(r => r.path.endsWith('/paged')).every(r => [1, 5].includes(role) ? !r.scope : r.scope === '1'))
    await c.close(); cases += 1
  }
  assert.deepEqual(errors, [])
  console.log(`PASS ${cases} notification pagination browser scenarios: 3 pages/size reset, bounded preview, independent unread/read-all, retry/empty/denied, silent live refresh, latest/dedup, out-of-range recovery, profile ABA/login races and AZ/EN/RU responsive light/dark`)
} finally { await browser.close() }
