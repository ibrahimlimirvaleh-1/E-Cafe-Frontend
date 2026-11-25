import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://ecafe.test', dist = path.resolve('dist'), errors = [], checks = []
assert.deepEqual(fs.readFileSync('public/ecafe-icon.png'), execFileSync('git', ['show', 'HEAD:public/ecafe-icon.png']), 'Fallback PNG must remain unchanged')
assert.deepEqual(fs.readFileSync('public/favicon.svg'), execFileSync('git', ['show', 'HEAD:public/favicon.svg']), 'Do not replace unrelated favicon')
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
async function setup(role, width, theme, collapsed) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript(({ role, theme, collapsed }) => {
    localStorage.setItem('ecafe.language', 'en'); localStorage.setItem('ecafe.theme', theme)
    localStorage.setItem('ecafe.admin.sidebar.collapsed', String(collapsed))
    if ([4, 6].includes(role)) localStorage.setItem('ecafe.activeProfile.42', `1:${role}`)
  }, { role, theme, collapsed })
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message))
  await page.routeWebSocket('**/hubs/user-events*', socket => socket.onMessage(m => { for (const p of m.toString().split('\x1e').filter(Boolean)) if (JSON.parse(p).protocol) socket.send('{}\x1e') }))
  const profiles = [4, 6].includes(role) ? [{ restaurantId: 1, restaurantName: 'Fixture Restaurant', roleId: role, isActive: true }] : []
  const user = { userId: '42', name: 'Brand', surname: 'QA', email: 'fixture@example.com', roleId: role, isActive: true, profiles }
  const token = `header.${Buffer.from(JSON.stringify({ ...user, roleId: String(role), restaurantId: profiles[0]?.restaurantId, restaurantIds: profiles.map(p => String(p.restaurantId)), restaurantRoles: profiles.map(p => `${p.restaurantId}:${p.roleId}`) })).toString('base64url')}.signature`
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), p = url.pathname
    if (url.origin !== origin) return route.abort()
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
    if (p === '/hubs/user-events/negotiate') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ negotiateVersion: 1, connectionId: 'fixture', connectionToken: 'fixture', availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }] }) })
    if (p.startsWith('/api/v1/')) {
      if (p === '/api/v1/user/refresh') return role ? json({ accessToken: token }) : route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'SessionInvalid' }) })
      if (p === '/api/v1/profile') return json(user)
      if (p.includes('localization/dictionaries')) return json({ language: 'en', version: 'fixture', fallbackLanguage: 'az', messages: {} })
      if (p.includes('localization/preference')) return json({ language: 'en' })
      if (p.endsWith('/notifications/paged')) return json({ items: [], pageIndex: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false })
      if (p.endsWith('/unread-count')) return json({ count: 0 })
      if (p.endsWith('/announcements/pending')) return json({ roleId: role, restaurantId: profiles.length ? 1 : null, items: [], hasMore: false })
      if (/\/dashboard\/(platform|owner|manager)$/.test(p)) return json({ view: p.split('/').at(-1), generatedAtUtc: '2026-11-25T12:00:00Z', from: '2026-11-24', to: '2026-11-25', timeZone: 'Asia/Baku', paymentMode: 'real', restaurants: [], metrics: [], financials: null, chart: { key: 'orders', unit: 'count', granularity: 'day', points: [] }, alerts: [], branchRows: [], sessionRows: [], pageIndex: 1, pageSize: 10, totalRows: 0 })
      return json([])
    }
    const file = path.join(dist, path.extname(p) ? p.slice(1) : 'index.html')
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream' })
  })
  return { page, context }
}
async function pixels(brand, theme) {
  const vector = await brand.locator('.brand-icon').evaluate(async node => {
    const svgs = [...node.querySelectorAll('svg')]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">${svgs.map(s => `<g fill="${s.getAttribute('fill')}" stroke="${s.getAttribute('stroke')}" stroke-width="${s.getAttribute('stroke-width')}" stroke-linecap="round" stroke-linejoin="round">${s.innerHTML}</g>`).join('')}</svg>`
    const image = new Image(); image.src = 'data:image/svg+xml;base64,' + btoa(svg); await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0)
    const data = ctx.getImageData(0, 0, 96, 96).data
    let transparent = 0, black = 0, white = 0, steamWhite = 0, steamBlack = 0
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) transparent++
      if (data[i + 3] > 200 && Math.max(data[i], data[i + 1], data[i + 2]) < 40) { black++; if (i < 96 * 24 * 4) steamBlack++ }
      if (data[i + 3] > 200 && Math.min(data[i], data[i + 1], data[i + 2]) > 240) { white++; if (i < 96 * 24 * 4) steamWhite++ }
    }
    const corners = [0, 95, 96 * 95, 96 * 96 - 1].map(index => data[index * 4 + 3])
    return { transparent, black, white, steamWhite, steamBlack, corners, background: getComputedStyle(node).backgroundColor }
  })
  assert.ok(vector.transparent > 96 * 96 * .35); assert.ok(vector.black > 100); assert.ok(vector.white > 100)
  assert.ok(vector.steamBlack > 10 && vector.steamWhite > 10, 'Steam has a white center with black contour')
  assert.deepEqual(vector.corners, [0, 0, 0, 0]); assert.equal(vector.background, 'rgba(0, 0, 0, 0)')
  const png = await brand.locator('.brand-icon').screenshot({ animations: 'disabled' })
  const rendered = await brand.evaluate(async (_, encoded) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + encoded; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const corners = [0, image.width - 1, image.width * (image.height - 1), image.width * image.height - 1].map(i => [...data.slice(i * 4, i * 4 + 3)])
    let changed = 0
    for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 80) changed++
    return { corners, changed }
  }, png.toString('base64'))
  assert.ok(rendered.changed > 20, 'Rendered icon is not blank')
  if (theme === 'dark') assert.ok(rendered.corners.every(pixel => Math.max(...pixel) < 150), 'No white square behind the icon in dark mode')
  return { vector, rendered }
}
try {
  const surfaces = [
    { name: 'public', role: 0, route: '/' },
    { name: 'customer', role: 5, route: '/notifications' },
    { name: 'waiter', role: 4, route: '/waiter' },
    { name: 'kitchen', role: 6, route: '/kitchen' },
    { name: 'admin', role: 1, route: '/admin' },
  ]
  for (const surface of surfaces) for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
    const { page, context } = await setup(surface.role, width, theme, false)
    await page.goto(origin + surface.route)
    if (surface.name === 'admin' && width < 1081) await page.locator('.admin-sidebar-menu').click()
    const brand = page.locator('.brand').filter({ visible: true }).first(); await brand.waitFor()
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
    assert.equal(await brand.locator('img').count(), 0); assert.equal(await brand.locator('svg.lucide-coffee').count(), 2)
    assert.equal(await brand.getAttribute('aria-label'), surface.name === 'admin' ? 'ECafe Admin' : 'ECafe')
    const box = await brand.locator('.brand-icon').boundingBox(); assert.equal(box.width, width > 1080 ? 32 : 28); assert.equal(box.height, box.width)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    checks.push({ surface: surface.name, width, theme, ...(await pixels(brand, theme)) })
    await page.screenshot({ path: path.join(dist, `brand-${surface.name}-${width}-${theme}.png`), animations: 'disabled' })
    if (surface.name === 'admin' && width > 1080) {
      await page.locator('.admin-sidebar-collapse').click()
      await page.locator('.admin-shell.is-collapsed').waitFor()
      const icon = await brand.locator('.brand-icon').boundingBox(), head = await page.locator('.admin-sidebar-head').boundingBox()
      assert.ok(Math.abs(icon.x + icon.width / 2 - head.x - head.width / 2) < 1, 'Collapsed icon stays centered')
      assert.equal(await brand.locator('strong').isVisible(), false)
      await pixels(brand, theme)
      await page.screenshot({ path: path.join(dist, `brand-admin-collapsed-${width}-${theme}.png`), animations: 'disabled' })
      checks.push({ surface: 'admin-collapsed', width, theme })
    }
    await context.close()
  }
  for (const route of ['/login', '/register', '/forgot-password', '/reset-password#token=fixture', '/set-password#token=fixture', '/confirm-email-change#token=fixture']) for (const theme of ['light', 'dark']) {
    const { page, context } = await setup(0, 320, theme, false); await page.goto(origin + route)
    const brand = page.locator('.auth-card .brand'); await brand.waitFor(); await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
    await pixels(brand, theme); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, `brand-auth-${route.split(/[?#]/)[0].slice(1)}-320-${theme}.png`), animations: 'disabled' })
    checks.push({ surface: route, width: 320, theme }); await context.close()
  }
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(dist, 'brand-icon-pixel-report.json'), JSON.stringify(checks, null, 2))
  console.log(`PASS ${checks.length} brand scenarios: public/customer/staff/admin/drawer/collapsed/auth, 32/28px geometry, transparent corners, white body/steam with black contour, nonblank actual pixels and unchanged PNG/favicon`)
} finally { await browser.close() }
