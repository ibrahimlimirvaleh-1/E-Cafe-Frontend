import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({
  userId: '3', name: 'QA', surname: 'Manager', roleId: '3', restaurantId: '1', restaurantRoles: ['1:3'],
})).toString('base64url')}.signature`

function reply(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function serveAsset(route, pathname) {
  const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
  if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  }[path.extname(file)] || 'application/octet-stream' })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  let reservationReads = 0
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(`${origin}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/v1/')) return serveAsset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return reply(route, { accessToken: token })
    if (pathname === '/api/v1/profile') return reply(route, {
      userId: '3', name: 'QA', surname: 'Manager', roleId: 3, restaurantId: 1, isActive: true,
      profiles: [{ restaurantId: 1, restaurantName: 'Test Restaurant', roleId: 3, roleName: 'Manager', isActive: true }],
    })
    if (pathname === '/api/v1/localization/preference') return reply(route, { language: 'az' })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return reply(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname.endsWith('/notifications')) return reply(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return reply(route, { count: 0 })
    const detail = /^\/api\/v1\/restaurants\/1\/reservations\/(100|101)$/.exec(pathname)
    if (detail) {
      reservationReads++
      return reply(route, {
        id: Number(detail[1]), restaurantId: 1, tableId: 1, tableName: 'Masa-1',
        restaurantName: 'Test Restaurant', customerName: `Test Customer ${reservationReads}`,
        reservedAt: '2026-11-02T19:00:00Z', timeZone: 'Asia/Baku', peopleCount: 2,
        status: 'Confirmed', statusId: 1004, workflowFlowCode: '', depositAmount: 0,
        tableSessionId: null, requiresReceptionReview: false,
        waiting: { waitingSinceAt: '2026-11-02T18:45:00Z', waitingMinutes: 15, serviceDelayMinutes: 0, isOverdue: false },
      })
    }
    if (/\/history$/.test(pathname)) return reply(route, { items: [] })
    if (/\/refund$/.test(pathname)) return reply(route, null)
    return reply(route, {})
  })

  await page.goto(`${origin}/admin/reservations/100?restaurantId=1`)
  const panel = page.locator('.reservation-waiting-management')
  await panel.waitFor()
  assert.equal(await panel.count(), 1)
  await panel.locator('.reservation-waiting-modes button').last().click()
  await panel.locator('textarea').fill('Test reason')

  for (let index = 0; index < 6; index++) {
    const previousReads = reservationReads
    const response = page.waitForResponse((item) => new URL(item.url()).pathname === '/api/v1/restaurants/1/reservations/100')
    await page.evaluate(() => window.dispatchEvent(new Event('ecafe:notifications-refresh')))
    await response
    assert.ok(reservationReads > previousReads)
    await page.getByText(`Test Customer ${reservationReads}`, { exact: true }).waitFor()
    assert.equal(await panel.count(), 1, `Waiting panel duplicated after refresh ${index + 1}`)
    assert.equal(await panel.locator('textarea').inputValue(), 'Test reason')
  }
  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/reservations/101?restaurantId=1')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByText('Rezervasiya #101', { exact: true }).waitFor()
  assert.equal(await panel.count(), 1)
  assert.equal(await panel.locator('textarea').count(), 0)
  assert.deepEqual(errors, [])
  await context.close()
  console.log('Reservation detail panel survives six refreshes and resets for a new reservation.')
} finally {
  await browser.close()
}
