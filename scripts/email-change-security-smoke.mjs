import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const secret = 'one-time-email-secret-do-not-store'
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map(language => [language, JSON.parse(fs.readFileSync(`src/shared/i18n/catalog/${language}.json`, 'utf8'))]))
const handoff = JSON.parse(fs.readFileSync('docs/email-change-ui-messages.json', 'utf8'))
for (const language of ['az', 'en', 'ru']) assert.deepEqual(handoff[language], Object.fromEntries(Object.entries(catalogs[language]).filter(([key]) => key.startsWith('ui.emailChange.'))))
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const pageErrors = []
const security = '/api/v1/profile/email-change/'
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
const error = (route, code, status) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code, message: 'Do not display raw provider errors', errors: [] }) })

async function setup(language = 'en', options = {}) {
  const roleId = options.roleId || 5
  const state = { requests: [], mode: 'accepted', confirmCode: options.confirmCode, delay: 0, signedIn: options.signedIn !== false }
  const accessToken = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'Test', surname: 'Customer', email: 'old@example.com', roleId: String(roleId), restaurantId: '1', restaurantIds: ['1'], restaurantRoles: roleId === 5 ? [] : [`1:${roleId}`] })).toString('base64url')}.signature`
  const profile = { userId: '42', name: 'Test', surname: 'Customer', email: 'old@example.com', phone: '+994501234567', roleId, isActive: true, profiles: [1, 5].includes(roleId) ? [] : [{ restaurantId: 1, restaurantName: 'Test Restaurant', roleId, roleName: 'Staff', isActive: true }] }
  const member = { id: 7, userId: 7, name: 'Staff', surname: 'Member', email: 'staff@example.com', phone: '+994501234567', roleId: 4, role: 'Waiter', isActive: true }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.addInitScript(language => {
    localStorage.setItem('ecafe.language', language)
    window.__securityStorageWrites = []
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { window.__securityStorageWrites.push(`${key}:${value}`); return set.call(this, key, value) }
  }, language)
  const page = await context.newPage()
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('console', message => assert.ok(!message.text().includes(secret), 'No token in console'))
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) return route.abort()
    const p = url.pathname
    if (p.startsWith('/api/v1/')) {
      state.requests.push({ path: p, method: request.method(), body: request.postData(), headers: request.headers() })
      assert.ok(!request.url().includes(secret), 'No token in request URL')
      if (p === '/api/v1/user/refresh') return state.signedIn ? json(route, { accessToken }) : error(route, 'SessionInvalid', 401)
      if (p === '/api/v1/profile') return request.method() === 'PUT' ? route.fulfill({ status: 204 }) : json(route, profile)
      if (p === '/api/v1/file/upload') return json(route, { id: 9, fileName: 'avatar.png' })
      if (p === `${security}request`) {
        await new Promise(resolve => setTimeout(resolve, state.delay))
        if (state.mode === 'password') return error(route, 'InvalidCredentials', 400)
        if (state.mode === 'limited') return error(route, 'TooManyRequests', 429)
        if (state.mode === 'session') return error(route, 'SessionInvalid', 401)
        if (state.mode === 'staff') return error(route, 'StaffProfileInactive', 401)
        return route.fulfill({ status: 202 })
      }
      if (p === `${security}confirm`) {
        await new Promise(resolve => setTimeout(resolve, state.delay))
        if (state.confirmCode) return error(route, state.confirmCode, state.confirmCode === 'SessionInvalid' ? 401 : state.confirmCode === 'TooManyRequests' ? 429 : 403)
        return route.fulfill({ status: 204 })
      }
      if (p.includes('localization/dictionaries')) return json(route, { language, version: 'test', fallbackLanguage: 'az', messages: {} })
      if (p.includes('localization/preference')) return json(route, { language })
      if (p.endsWith('/unread-count')) return json(route, { count: 0 })
      if (p.includes('/notifications')) return json(route, { items: [], totalCount: 0 })
      if (p.includes('/lookups/roles')) return json(route, [{ id: 4, name: 'Waiter', isStaffAssignable: true }])
      if (p === '/api/v1/staff/1/detail/7') return json(route, member)
      if (p === '/api/v1/staff/1') return json(route, [member])
      if (p === '/api/v1/restaurants/1/staff/7') return route.fulfill({ status: 204 })
      if (p === '/api/v1/restaurants/getAll' || p === '/api/v1/public/restaurants' || p === '/api/v1/admin/restaurants') return json(route, [{ id: 1, name: 'Test Restaurant', isActive: true }])
      return json(route, {})
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  return { page, context, state, t: key => catalogs[language][`ui.emailChange.${key}`] }
}

async function noLeaks(page) {
  assert.ok(!page.url().includes(secret))
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, writes: window.__securityStorageWrites, history: history.state }))
  assert.ok(!stored.includes(secret), 'Token absent from storage writes and router state')
}

try {
  for (const language of ['az', 'en', 'ru']) {
    const { page, context, state, t } = await setup(language)
    await page.goto(`${origin}/account`)
    const email = page.locator('.profile-account-form input[type=email]')
    await email.waitFor()
    assert.equal(await email.getAttribute('readonly'), '')
    // The readonly DOM can be tampered with; profile saves still use the loaded email.
    await email.evaluate(input => { input.removeAttribute('readonly'); input.value = 'bypass@example.com'; input.dispatchEvent(new Event('input', { bubbles: true })) })
    await page.locator('.profile-account-form input').first().fill('Updated')
    await page.locator('.profile-account-form input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aONsAAAAASUVORK5CYII=', 'base64') })
    await page.waitForFunction(() => document.querySelector('.upload-field small')?.textContent?.includes('9'))
    await page.locator('.profile-account-form button[type=submit]').click()
    await page.waitForFunction(() => !document.querySelector('.profile-account-form button[type=submit]').disabled)
    const save = state.requests.find(r => r.path === '/api/v1/profile' && r.method === 'PUT')
    assert.match(save.body, /old@example.com/)
    assert.doesNotMatch(save.body, /bypass@example.com/)
    assert.match(save.body, /Updated/)
    assert.match(save.body, /\+994501234567/)
    assert.match(save.body, /name="FileId"\r?\n\r?\n9/)
    await page.getByRole('button', { name: t('change'), exact: true }).click()
    const modal = page.locator('dialog.email-change-dialog')
    await modal.waitFor()
    await modal.locator('input[type=email]').fill('new@example.com')
    await modal.locator('input[type=password]').fill('CurrentPassword1!')
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 650 }]) {
      await page.setViewportSize(viewport)
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
        const box = await modal.boundingBox()
        assert.ok(box.x >= 0 && box.x + box.width <= viewport.width)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await page.screenshot({ animations: 'disabled', path: path.join(dist, `email-change-${language}-${viewport.width}-${theme}.png`) })
      }
    }
    state.delay = 350
    await modal.locator('button[type=submit]').click()
    await modal.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    await page.keyboard.press('Escape')
    assert.equal(await modal.isVisible(), true, 'Cannot dismiss pending request')
    assert.equal(await modal.locator('input[type=password]').inputValue(), '')
    await page.getByText(t('accepted'), { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ animations: 'disabled', path: path.join(dist, `email-change-accepted-${language}-320.png`) })
    assert.equal(state.requests.filter(r => r.path === `${security}request`).length, 1, 'Double click submits once')
    const payload = state.requests.find(r => r.path === `${security}request`)
    assert.equal(payload.method, 'POST')
    assert.deepEqual(JSON.parse(payload.body), { newEmail: 'new@example.com', currentPassword: 'CurrentPassword1!' })
    assert.match(payload.headers.authorization, /^Bearer /)
    await modal.locator('header button').click()
    await page.getByRole('button', { name: t('change'), exact: true }).click()
    assert.equal(await modal.locator('button[type=submit]').isDisabled(), true, 'Cooldown survives closing/reopening')
    await page.keyboard.press('Escape')
    assert.equal(await modal.count(), 0)
    await context.close()

    const confirmation = await setup(language)
    await confirmation.page.goto(`${origin}/confirm-email-change#token=${secret}`)
    const button = confirmation.page.getByRole('button', { name: t('confirm'), exact: true })
    await button.waitFor()
    await noLeaks(confirmation.page)
    assert.equal(confirmation.state.requests.filter(r => r.path.startsWith(security)).length, 0, 'No confirmation on page load')
    for (const width of [1440, 390, 320]) {
      await confirmation.page.setViewportSize({ width, height: 844 })
      assert.equal(await confirmation.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await confirmation.page.screenshot({ animations: 'disabled', path: path.join(dist, `email-confirm-${language}-${width}.png`) })
    }
    confirmation.state.delay = 250
    await button.click()
    await confirmation.page.locator('.email-change-confirm button').evaluate(node => node.click())
    await confirmation.page.getByText(t('success'), { exact: true }).waitFor()
    await confirmation.page.screenshot({ animations: 'disabled', path: path.join(dist, `email-confirm-success-${language}-320.png`) })
    assert.equal(confirmation.state.requests.filter(r => r.path === `${security}confirm`).length, 1)
    const confirm = confirmation.state.requests.find(r => r.path === `${security}confirm`)
    assert.equal(confirm.method, 'POST')
    assert.deepEqual(JSON.parse(confirm.body), { token: secret })
    assert.equal(await confirmation.page.evaluate(() => Boolean(localStorage.getItem('ecafe.manualLogoutAt'))), true)
    assert.equal(confirmation.state.requests.filter(r => r.path.includes('/logout')).length, 0, 'Local clear without another API call')
    await noLeaks(confirmation.page)
    await confirmation.page.getByRole('link', { name: t('login'), exact: true }).click()
    assert.equal(new URL(confirmation.page.url()).pathname, '/login')
    await confirmation.context.close()
  }

  for (const code of ['EmailChangeInvalidOrExpired', 'SessionInvalid', 'TooManyRequests']) {
    const { page, context, state, t } = await setup('en', { confirmCode: code })
    await page.goto(`${origin}/confirm-email-change#token=${secret}`)
    await page.getByRole('button', { name: t('confirm'), exact: true }).click()
    await page.getByText(t(code === 'SessionInvalid' ? 'loginRequired' : code === 'TooManyRequests' ? 'rateLimited' : 'invalidLink'), { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: t('confirm'), exact: true }).count(), 0)
    assert.equal(state.requests.filter(r => r.path === `${security}confirm`).length, 1)
    assert.equal(state.requests.filter(r => r.path === '/api/v1/user/refresh').length, 1, 'Security request does not replay via refresh')
    await noLeaks(page)
    await context.close()
  }
  for (const options of [{ signedIn: false }, {}]) {
    const { page, context, state, t } = await setup('en', options)
    await page.goto(`${origin}/confirm-email-change${options.signedIn === false ? `#token=${secret}` : ''}`)
    await page.getByText(t(options.signedIn === false ? 'loginRequired' : 'invalidLink'), { exact: true }).waitFor()
    assert.equal(state.requests.filter(r => r.path.startsWith(security)).length, 0)
    await noLeaks(page)
    await context.close()
  }
  for (const suffix of [`/#token=${secret}`, `?token=${secret}`, `#token=${secret}&token=duplicate`]) {
    const { page, context, state, t } = await setup()
    await page.goto(`${origin}/CONFIRM-EMAIL-CHANGE${suffix}`)
    if (suffix.startsWith('/')) await page.getByRole('button', { name: t('confirm'), exact: true }).waitFor()
    else await page.getByText(t('invalidLink'), { exact: true }).waitFor()
    assert.equal(page.url(), `${origin}/confirm-email-change`)
    assert.equal(state.requests.filter(r => r.path.startsWith(security)).length, 0)
    await noLeaks(page)
    await context.close()
  }
  for (const mode of ['password', 'limited', 'session']) {
    const { page, context, state, t } = await setup()
    state.mode = mode
    await page.goto(`${origin}/account`)
    await page.getByRole('button', { name: t('change'), exact: true }).click()
    const modal = page.locator('dialog')
    await modal.locator('input[type=email]').fill('new@example.com')
    await modal.locator('input[type=password]').fill('wrong')
    await modal.locator('button[type=submit]').click()
    await page.getByText(t(mode === 'password' ? 'invalidPassword' : mode === 'limited' ? 'rateLimited' : 'requestLoginRequired'), { exact: true }).waitFor()
    assert.equal(await modal.locator('input[type=password]').inputValue(), '')
    assert.equal(state.requests.filter(r => r.path === `${security}request`).length, 1)
    await context.close()
  }
  for (const operation of ['request', 'confirm']) {
    const { page, context, state, t } = await setup('en', { roleId: 3, ...(operation === 'confirm' ? { confirmCode: 'StaffProfileInactive' } : {}) })
    if (operation === 'request') {
      state.mode = 'staff'
      await page.goto(`${origin}/account`)
      await page.getByRole('button', { name: t('change'), exact: true }).click()
      const modal = page.locator('dialog')
      await modal.locator('input[type=email]').fill('new@example.com')
      await modal.locator('input[type=password]').fill('CurrentPassword1!')
      await modal.locator('button[type=submit]').click()
    } else {
      await page.goto(`${origin}/confirm-email-change#token=${secret}`)
      await page.getByRole('button', { name: t('confirm'), exact: true }).click()
    }
    await page.waitForURL(`${origin}/login`)
    await page.locator('.auth-card .form-message-danger').filter({ hasText: catalogs.en['ui.staffAccess.inactive'] }).waitFor()
    assert.equal(state.requests.filter(r => r.path === `${security}${operation}`).length, 1)
    assert.equal(state.requests.filter(r => r.path === '/api/v1/user/refresh').length, 1, 'Terminal staff denial never replays a protected security operation')
    await noLeaks(page)
    await context.close()
  }
  for (const roleId of [1, 2, 3]) {
    const { page, context, state } = await setup('en', { roleId })
    await page.goto(`${origin}/admin/staff/7/edit?restaurantId=1`)
    const email = page.locator('input[type=email]')
    await email.waitFor()
    await page.waitForFunction(() => document.querySelector('input[type=email]')?.value === 'staff@example.com')
    assert.equal(await email.getAttribute('readonly'), '', `Staff email readonly for role ${roleId}`)
    await email.evaluate(input => { input.removeAttribute('readonly'); input.value = 'bypass@example.com'; input.dispatchEvent(new Event('input', { bubbles: true })) })
    await page.locator('form button[type=submit]').click()
    await page.waitForFunction(() => document.querySelector('input[type=email]')?.value === 'staff@example.com')
    const update = state.requests.find(r => r.path === '/api/v1/restaurants/1/staff/7' && r.method === 'PUT')
    assert.ok(update, `Staff update for role ${roleId}`)
    assert.match(update.body, /staff@example.com/)
    assert.doesNotMatch(update.body, /bypass@example.com/)
    await context.close()
  }
  assert.deepEqual(pageErrors, [])
  console.log('PASS 22 email-change scenarios: AZ/EN/RU, desktop/mobile/light/dark, readonly profile/staff roles, generic request, cooldown, double click, token scrub/no storage, explicit confirm, wrong account/expired/rate limit/session errors, terminal staff denial for request/confirm, local logout')
} finally { await browser.close() }
