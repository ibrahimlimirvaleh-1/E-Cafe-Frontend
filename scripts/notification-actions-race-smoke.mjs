import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = process.cwd()
const mock = {
  AuthContext: 'export const useAuth = () => window.__auth',
  ecafeApi: 'export const ecafeApi = { notifications: { markAsRead: (id, signal) => window.__request(id, signal), markAllAsRead: signal => window.__request("all", signal) } }',
  httpClient: 'export class ApiError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode } }; window.__ApiError = ApiError; export const normalizeCaughtApiError = (e, fallback) => ({ message: e.message || fallback })',
  i18n: 'export const i18n = { t: key => key }',
  notificationTarget: 'export const getNotificationTarget = n => `/confirmation?reservationId=${n.id}`',
}
const result = await build({
  stdin: {
    resolveDir: root, loader: 'jsx', contents: `
      import React, { useState } from 'react'
      import { createRoot } from 'react-dom/client'
      import { useNotificationActions } from './src/shared/notifications/useNotificationActions'
      window.__requests = []; window.__nav = []; window.__success = []
      window.__auth = { user: { userId: '42', restaurantId: '1', roleId: '3' }, scopeRevision: '1:0', selectProfileForRestaurant: id => window.__nav.push('scope:' + id) }
      window.__request = (id, signal) => new Promise((resolve, reject) => window.__requests.push({ id, signal, resolve, reject }))
      function App() {
        const [, render] = useState(0)
        const actions = useNotificationActions()
        window.__actions = actions
        window.__switch = (restaurantId, revision = window.__auth.scopeRevision) => { window.__auth = { ...window.__auth, user: { ...window.__auth.user, restaurantId }, scopeRevision: revision }; render(x => x + 1) }
        return <div><span id="pending">{String(actions.isUpdating)}</span><span id="error">{actions.error}</span><span id="denied">{String(actions.accessDenied)}</span></div>
      }
      createRoot(document.getElementById('app')).render(<App />)
    `,
  }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'notification-test-dependencies', setup(builder) {
    builder.onResolve({ filter: /react-router-dom$/ }, () => ({ path: 'router', namespace: 'mock' }))
    builder.onLoad({ filter: /^router$/, namespace: 'mock' }, () => ({ contents: 'export const useNavigate = () => target => window.__nav.push(target)' }))
    for (const name of Object.keys(mock)) builder.onResolve({ filter: new RegExp(`/${name}$`) }, args => args.importer.endsWith('useNotificationActions.ts') ? ({ path: name, namespace: 'mock' }) : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => mock[args.path] ? { contents: mock[args.path] } : undefined)
  } }],
})
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
let cases = 0
try {
  async function setup() {
    const page = await browser.newPage()
    await page.route('**/*', route => route.abort())
    await page.route('https://notification.test/', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<div id="app"></div>' }))
    await page.goto('https://notification.test/')
    await page.addScriptTag({ content: result.outputFiles[0].text })
    await page.locator('#pending').filter({ hasText: 'false' }).waitFor()
    return page
  }
  async function start(page, id = 'old') {
    await page.evaluate(id => { void window.__actions.openNotification({ id, isRead: false }, () => window.__success.push(id)) }, id)
    await page.waitForFunction(() => document.querySelector('#pending').textContent === 'true')
  }
  async function switchTo(page, restaurantId, revision) {
    await page.evaluate(({ restaurantId, revision }) => window.__switch(restaurantId, revision), { restaurantId, revision })
    await page.waitForFunction(() => document.querySelector('#pending').textContent === 'false')
  }
  async function finish(page, index, status) {
    await page.evaluate(({ index, status }) => { const request = window.__requests[index]; if (status) request.reject(new window.__ApiError('Denied', status)); else request.resolve() }, { index, status })
    await page.evaluate(() => new Promise(requestAnimationFrame))
  }
  for (const status of [undefined, 403, 500]) {
    const page = await setup()
    await start(page)
    await switchTo(page, '2')
    await start(page, 'new')
    assert.deepEqual(await page.evaluate(() => window.__requests.map(r => r.signal.aborted)), [true, false], 'Only the previous scope request is aborted')
    await finish(page, 0, status)
    assert.equal(await page.locator('#pending').innerText(), 'true', 'Old completion must not unlock a newer operation')
    assert.equal(await page.locator('#error').innerText(), '')
    await page.evaluate(() => { void window.__actions.markAllAsRead(() => window.__success.push('duplicate')) })
    assert.equal(await page.evaluate(() => window.__requests.length), 2, 'New scope accepts one action but still rejects its double submit')
    await finish(page, 1)
    assert.deepEqual(await page.evaluate(() => window.__success), ['new'])
    assert.deepEqual(await page.evaluate(() => window.__nav), ['/confirmation?reservationId=new'])
    assert.equal(await page.locator('#pending').innerText(), 'false')
    await page.close(); cases += 1
  }
  for (const transition of ['profile-aba', 'same-user-new-session']) {
    const page = await setup(); await start(page)
    if (transition === 'profile-aba') { await switchTo(page, '2'); await switchTo(page, '1') }
    else await switchTo(page, '1', '2:0')
    await finish(page, 0)
    assert.deepEqual(await page.evaluate(() => window.__success), [], 'Returning to the same profile/account cannot revive an old action')
    assert.deepEqual(await page.evaluate(() => window.__nav), [])
    await start(page, 'fresh'); await finish(page, 1)
    assert.deepEqual(await page.evaluate(() => window.__success), ['fresh'])
    await page.close(); cases += 1
  }
  {
    const page = await setup(); await start(page)
    await finish(page, 0, 403)
    assert.equal(await page.locator('#denied').innerText(), 'true')
    assert.equal(await page.locator('#pending').innerText(), 'false')
    await switchTo(page, '2')
    assert.equal(await page.locator('#denied').innerText(), 'false')
    await start(page, 'fresh'); await finish(page, 1)
    await page.close(); cases += 1
  }
  console.log(`PASS ${cases} non-remounting notification action races: scope-specific pending, stale success/403/network failure, new-operation lock, profile ABA, same-user login epoch and denied-scope recovery`)
} finally { await browser.close() }
