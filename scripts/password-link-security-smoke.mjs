import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { build } = require('esbuild')
const origin = 'http://ecafe.test', dist = path.resolve('dist')
const secret = 'ECAFE-SYNTHETIC-NONSECRET-a%2Bb%2Fc%3D', decoded = decodeURIComponent(secret)
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map(l => [l, JSON.parse(fs.readFileSync(`src/shared/i18n/catalog/${l}.json`, 'utf8'))]))
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
let cases = 0
const errors = []
async function setup(language = 'en', expired = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await context.addInitScript(language => {
    localStorage.setItem('ecafe.language', language)
    window.__writes = []; window.__historyWrites = []; window.__unhandled = []
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { window.__writes.push(`${key}:${value}`); return set.call(this, key, value) }
    const replace = history.replaceState.bind(history)
    history.replaceState = (state, unused, url) => { window.__historyWrites.push(JSON.stringify({ state, url })); return replace(state, unused, url) }
    window.addEventListener('unhandledrejection', e => window.__unhandled.push(String(e.reason)))
  }, language)
  const page = await context.newPage(), requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => assert.ok(!message.text().includes('ECAFE-SYNTHETIC'), 'No secret in console'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname
    if (url.origin !== origin) return route.abort()
    requests.push({ url: request.url(), path: p, method: request.method(), body: request.postData(), navigation: request.isNavigationRequest(), referer: request.headers().referer || '' })
    if (p.startsWith('/api/v1/')) {
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
      if (p === '/api/v1/user/refresh') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'SessionInvalid', message: 'Sign in' }) })
      if (p === '/api/v1/user/reset-password' || p === '/api/v1/user/set-password') {
        if (expired) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'InvalidToken', message: language === 'az' ? 'Linkin müddəti bitib.' : language === 'ru' ? 'Срок действия ссылки истёк.' : 'This link has expired.' }) })
        return route.fulfill({ status: 204 })
      }
      if (p.includes('localization/dictionaries')) return json({ language, version: 'fixture', fallbackLanguage: 'az', messages: {} })
      if (p.includes('localization/preference')) return json({ language })
      return json({})
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, headers: { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream', 'Referrer-Policy': 'no-referrer' }, body: fs.readFileSync(file) })
  })
  const posts = () => requests.filter(r => /\/user\/(reset|set)-password$/.test(r.path) && r.method === 'POST')
  async function clean({ legacy = false } = {}) {
    const snapshot = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, writes: window.__writes, historyWrites: window.__historyWrites, history: history.state, url: location.href, dom: document.body.innerText }))
    assert.ok(!snapshot.includes('ECAFE-SYNTHETIC'), 'No secret in storage, history, URL or rendered text')
    assert.deepEqual(await page.evaluate(() => window.__unhandled), [])
    const leaks = requests.filter(r => r.url.includes('ECAFE-SYNTHETIC'))
    assert.equal(leaks.length, legacy ? 1 : 0, 'Only a legacy initial document request may contain its query')
    if (legacy) assert.equal(leaks[0].navigation, true)
    assert.ok(requests.every(r => !r.referer.includes('ECAFE-SYNTHETIC')), 'No secret Referer')
  }
  return { page, context, requests, posts, clean, close: () => context.close() }
}
async function fill(page) {
  await page.locator('input[type=password]').nth(0).fill('NewPassword123!')
  await page.locator('input[type=password]').nth(1).fill('NewPassword123!')
}
const forms = ['reset-password', 'set-password']
try {
  for (const form of forms) for (const language of ['az', 'en', 'ru']) for (const mode of ['fragment', 'legacy', 'expired']) {
    const c = await setup(language, mode === 'expired')
    await c.page.goto(`${origin}/${form}${mode === 'legacy' ? '?' : '#'}token=${secret}`)
    await c.page.locator('.auth-card input[type=password]').first().waitFor()
    assert.equal(new URL(c.page.url()).search, ''); assert.equal(new URL(c.page.url()).hash, '')
    assert.equal(c.posts().length, 0, 'No password operation on opening a link')
    await fill(c.page)
    await c.page.setViewportSize({ width: 320, height: 900 })
    await c.page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    assert.equal(await c.page.locator('button[type=submit]').isEnabled(), true, 'Token survives typing/rerenders after URL scrub')
    assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    if (mode === 'fragment') for (const [width, theme] of [[1440, 'light'], [390, 'light'], [320, 'dark']]) {
      await c.page.setViewportSize({ width, height: 900 }); await c.page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
      assert.equal(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await c.page.screenshot({ path: path.join(dist, `password-link-${form}-${language}-${width}-${theme}.png`), animations: 'disabled' })
    }
    await c.page.locator('button[type=submit]').click()
    if (mode === 'expired') await c.page.locator('.form-message-danger').waitFor()
    else await c.page.getByText(catalogs[language][`ui.passwordLink.${form === 'reset-password' ? 'resetComplete' : 'setComplete'}`], { exact: true }).waitFor()
    assert.equal(c.posts().length, 1)
    assert.deepEqual(JSON.parse(c.posts()[0].body), { token: decoded, password: 'NewPassword123!', confirmPassword: 'NewPassword123!' })
    await c.clean({ legacy: mode === 'legacy' })
    if (mode === 'expired') {
      await c.page.reload(); await c.page.locator('.auth-card input[type=password]').first().waitFor()
      assert.equal(await c.page.locator('button[type=submit]').isDisabled(), true, 'Reload intentionally cannot recover a scrubbed memory-only token')
      await c.page.getByText(catalogs[language]['ui.passwordLink.invalid'], { exact: true }).waitFor()
    }
    await c.close(); cases += 1
  }
  for (const form of forms) for (const suffix of ['', '#', '#token=', '?token=', '#token=one&token=two', '?token=one&token=two', '?token=legacy#token=', '#token=a%20b', '#token=' + 'x'.repeat(4097)]) {
    const c = await setup(); await c.page.goto(`${origin}/${form}${suffix}`)
    await c.page.getByText(catalogs.en['ui.passwordLink.invalid'], { exact: true }).waitFor()
    assert.equal(await c.page.locator('button[type=submit]').isDisabled(), true)
    assert.equal(c.posts().length, 0); assert.ok(!c.page.url().includes('token='))
    await c.close(); cases += 1
  }
  for (const form of forms) for (const language of ['az', 'en', 'ru']) {
    const c = await setup(language); await c.page.goto(`${origin}/${form}#token=${secret}`)
    await c.page.locator('input[type=password]').first().waitFor(); await c.page.reload()
    await c.page.getByText(catalogs[language]['ui.passwordLink.invalid'], { exact: true }).waitFor()
    assert.equal(await c.page.locator('button[type=submit]').isDisabled(), true); assert.equal(c.posts().length, 0)
    await c.clean(); await c.close(); cases += 1
  }
  {
    const c = await setup(); await c.page.goto(`${origin}/reset-password?keep=yes&token=ECAFE-SYNTHETIC-NONSECRET-LEGACY#token=${secret}&view=preview`)
    await c.page.locator('input[type=password]').first().waitFor(); await fill(c.page); await c.page.locator('button[type=submit]').click()
    await c.page.locator('.form-message-success').waitFor()
    assert.equal(JSON.parse(c.posts()[0].body).token, decoded, 'Fragment has precedence; query secret is still removed')
    assert.equal(new URL(c.page.url()).searchParams.get('keep'), 'yes'); assert.equal(new URLSearchParams(new URL(c.page.url()).hash.slice(1)).get('view'), 'preview')
    assert.ok(!c.page.url().includes('token=')); await c.clean({ legacy: true }); await c.close(); cases += 1
  }
  // Bundle only the real capture hook in development React to exercise StrictMode's double initializer/effect replay.
  const hook = path.resolve('src/features/passwordLink/passwordLinkToken.ts').replaceAll('\\', '/')
  const development = await build({ stdin: { contents: `import React,{StrictMode,useState} from 'react';import{createRoot}from'react-dom/client';import{usePasswordLinkToken}from ${JSON.stringify(hook)};function App(){const token=usePasswordLinkToken(location.pathname);const[n,setN]=useState(0);return <><button id="rerender" onClick={()=>setN(n+1)}>Render {n}</button><button id="send" disabled={!token} onClick={()=>window.receive(token)}>Send</button></>}createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } })
  for (const form of forms) for (const prefix of ['#', '?']) {
    const context = await browser.newContext(), page = await context.newPage(), received = []
    await page.exposeFunction('receive', value => received.push(value))
    await page.route(`${origin}/**`, route => new URL(route.request().url()).pathname === '/fixture.js' ? route.fulfill({ contentType: 'text/javascript', body: development.outputFiles[0].text }) : route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script src="/fixture.js"></script>' }))
    await page.goto(`${origin}/${form}${prefix}token=${secret}`)
    await page.locator('#rerender').click(); await page.locator('#rerender').click(); await page.locator('#send').click()
    await page.waitForFunction(() => document.querySelector('#rerender').textContent === 'Render 2')
    assert.deepEqual(received, [decoded]); assert.equal(page.url(), `${origin}/${form}`)
    await context.close(); cases += 1
  }
  assert.deepEqual(errors, [])
  console.log(`PASS ${cases} password-link scenarios: fragment/legacy precedence and scrub, memory-only refresh, malformed/missing/expired links, exact POST body, AZ/EN/RU 320px dark, no storage/history/Referer leaks and development StrictMode`)
} finally { await browser.close() }
