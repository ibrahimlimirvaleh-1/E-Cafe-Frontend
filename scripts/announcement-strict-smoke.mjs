import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { build } = require('esbuild'), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
  import React, { StrictMode, useState } from 'react'
  import { createRoot } from 'react-dom/client'
  import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
  import './src/shared/i18n/i18n'
  import { AnnouncementPanel } from './src/features/announcements/AnnouncementPanel'
  window.__auth = { user: { userId: '42', roleId: '3', restaurantId: '1' }, isAuthenticated: true, isAuthReady: true, isProfileVerified: true, scopeRevision: '0:0' }
  window.__auth.isCurrentSession = (id, epoch, role, restaurant) => window.__auth.user.userId === id && window.__auth.scopeRevision.split(':')[0] === epoch && window.__auth.user.roleId === role && window.__auth.user.restaurantId === restaurant
  window.__context = { restaurantId: '1', roleId: '3' }; window.__requests = []
  window.__request = (kind, signal, id, version) => new Promise((resolve, reject) => {
    window.__requests.push({ kind, signal, id, version, resolve, reject })
    if (kind === 'get') signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  function Harness() {
    const [, render] = useState(0), location = useLocation(), navigate = useNavigate()
    window.__switch = (restaurantId, epoch = '0:0') => { window.__context = { restaurantId, roleId: '3' }; window.__auth = { ...window.__auth, user: { ...window.__auth.user, restaurantId }, scopeRevision: epoch }; render(v => v + 1) }
    window.__go = navigate
    return <><div id="route">{location.pathname}</div><AnnouncementPanel /></>
  }
  createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><Harness /></BrowserRouter></StrictMode>)
` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'mock-announcement-context', setup(b) {
  b.onResolve({ filter: /\/auth\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'mock' }))
  b.onResolve({ filter: /\/auth\/activeProfileStorage$/ }, () => ({ path: 'profile', namespace: 'mock' }))
  b.onResolve({ filter: /\/announcementApi$/ }, () => ({ path: 'api', namespace: 'mock' }))
  b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'auth' ? 'export const useAuth = () => window.__auth' : args.path === 'profile' ? 'export const getActiveProfileContext = () => window.__context' : 'export const announcementApi = { pending: signal => window.__request("get", signal), acknowledge: (id, version, signal) => window.__request("ack", signal, id, version) }; export const announcementTarget = () => "/account"' }))
} }] })
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const feed = (restaurantId, id = 1) => ({ roleId: 3, restaurantId, items: [id, id + 1].map(id => ({ id, version: 1, title: `Card ${id}`, body: 'Update', destination: 'Inventory', publishedAtUtc: '2026-11-23T00:00:00Z' })), hasMore: false })
let cases = 0
try {
  async function setup() {
    const page = await browser.newPage()
    await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<div id="root"></div>' }))
    await page.goto('https://announcements.test/notifications')
    await page.evaluate(() => localStorage.setItem('ecafe.language', 'en'))
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await page.waitForFunction(() => window.__requests?.length === 2)
    assert.deepEqual(await page.evaluate(() => window.__requests.map(r => r.signal.aborted)), [true, false], 'StrictMode cancels first setup and starts a live second request')
    await page.evaluate(data => window.__requests[1].resolve(data), feed(1))
    try { await page.locator('.announcement-panel h2').filter({ hasText: 'Card 1' }).waitFor({ timeout: 5000 }) }
    catch (error) { console.log(await page.evaluate(() => ({ html: document.body.innerHTML, auth: window.__auth, requests: window.__requests.map(r => ({ kind: r.kind, aborted: r.signal.aborted })), hidden: document.hidden }))); throw error }
    return page
  }
  { const page = await setup(); assert.equal(await page.locator('dialog, .modal-backdrop').count(), 0); await page.close(); cases += 1 }
  {
    const page = await setup()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForFunction(() => window.__requests.length === 3)
    await page.evaluate(() => window.__switch('2'))
    await page.waitForFunction(() => window.__requests.length === 4)
    await page.evaluate(data => window.__requests[3].resolve(data), feed(2, 2))
    await page.locator('.announcement-panel h2').filter({ hasText: 'Card 2' }).waitFor()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForFunction(() => window.__requests.length === 5)
    await page.evaluate(() => window.__requests[2].resolve())
    await page.evaluate(() => new Promise(requestAnimationFrame))
    assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true)
    await page.evaluate(() => window.__requests[4].resolve())
    await page.locator('.announcement-panel h2').filter({ hasText: 'Card 3' }).waitFor()
    await page.close(); cases += 1
  }
  {
    const page = await setup(); await page.evaluate(() => window.__switch('2')); await page.waitForFunction(() => window.__requests.length === 3)
    await page.evaluate(() => window.__switch('1')); await page.waitForFunction(() => window.__requests.length === 4)
    await page.evaluate(data => { window.__requests[2].resolve(data); window.__requests[3].resolve({ ...data, restaurantId: 1, items: data.items.map(i => ({ ...i, id: i.id + 10, title: 'Fresh A' })) }) }, feed(2))
    await page.locator('.announcement-panel h2').filter({ hasText: 'Fresh A' }).waitFor()
    await page.close(); cases += 1
  }
  for (const action of ['route', 'hidden', 'epoch']) {
    const page = await setup(); await page.getByRole('button', { name: 'Open', exact: true }).click(); await page.waitForFunction(() => window.__requests.length === 3)
    await page.evaluate(action => { if (action === 'route') window.__go('/orders'); if (action === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) }; if (action === 'epoch') window.__switch('1', '1:0') }, action)
    await page.evaluate(() => window.__requests[2].resolve())
    await page.evaluate(() => new Promise(requestAnimationFrame))
    assert.notEqual(await page.locator('#route').innerText(), '/account', `A stale/background CTA cannot navigate: ${action}`)
    await page.close(); cases += 1
  }
  console.log(`PASS ${cases} development React.StrictMode announcement scenarios: setup-cleanup-setup, scope pending ownership, ABA, route/visibility/new-login epoch guards`)
} finally { await browser.close() }
