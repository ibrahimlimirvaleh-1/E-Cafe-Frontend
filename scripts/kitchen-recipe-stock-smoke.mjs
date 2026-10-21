import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Chef', email: 'chef@example.com', roleId: '6', roleName: 'Kitchen', restaurantId: '1', restaurantRoles: ['1:6'] })).toString('base64url')}.signature`
const startedAt = '2026-10-21T09:00:00Z'
const postCounts = new Map()
const statuses = new Map([[10, 2002], [11, 2002], [12, 2002], [13, 2002], [14, 2002], [15, 2002]])

function order(id) {
  const statusId = statuses.get(id)
  return {
    id, restaurantId: 1, tableId: id, tableName: `Masa-${id}`, statusId,
    sentToKitchenAt: startedAt, acceptedAt: startedAt,
    preparingAt: statusId >= 2003 ? startedAt : null,
    canAccept: false, canStartPreparing: statusId === 2002, canMarkReady: statusId === 2003,
    items: [{ id, itemId: id, name: `Məhsul ${id}`, quantity: 1 }],
  }
}

function json(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    if (pathname.startsWith('/api/v1/')) {
      if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
      if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Chef', roleId: 6, isActive: true, profiles: [{ restaurantId: 1, restaurantName: 'Test Restaurant', roleId: 6, roleName: 'Kitchen', isActive: true }] })
      if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
      if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) return json(route, { language: pathname.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
      if (pathname === '/api/v1/restaurants/1/kitchen/orders' && route.request().method() === 'GET') {
        return json(route, { items: [10, 11, 12, 13, 14, 15].map(order), pageIndex: 1, totalPages: 1, totalCount: 6 })
      }
      const startMatch = /^\/api\/v1\/restaurants\/1\/kitchen\/orders\/(\d+)\/start$/.exec(pathname)
      if (startMatch && route.request().method() === 'POST') {
        const id = Number(startMatch[1])
        const count = (postCounts.get(id) || 0) + 1
        postCounts.set(id, count)
        if (id === 10 && count === 1) return route.fulfill({
          status: 409, contentType: 'application/json',
          body: JSON.stringify({ statusCode: 409, code: 'KitchenOrderStockInsufficient', message: 'Tomat çatışmır: 2 kq tələb olunur.', errors: [{ field: 'Inventory', message: 'Tomat: 1 kq mövcuddur.' }] }),
        })
        if (id === 14 || id === 15) return route.fulfill({
          status: 409, contentType: 'application/json',
          body: JSON.stringify({ statusCode: 409,
            code: id === 14 ? 'KitchenOrderRecipeInvalid' : 'KitchenOrderStockStateInvalid',
            message: id === 14 ? 'Resept düzgün qurulmayıb. Menecer yoxlasın.' : 'Stok uçotu uyğun deyil. Menecerə müraciət edin.' }),
        })
        if (id === 12 && count === 1) return route.abort('failed')
        if (id === 13 && count === 1) {
          statuses.set(id, 2003)
          return route.abort('failed')
        }
        if (id === 11) await new Promise((resolve) => setTimeout(resolve, 350))
        statuses.set(id, 2003)
        return json(route, order(id))
      }
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })

  await page.goto(`${origin}/kitchen`)
  const row = (id) => page.locator('.kitchen-queue-row', { hasText: `#${id}` })
  await row(10).getByRole('button', { name: 'Hazırlamağa başla' }).click()
  await row(10).getByText('Tomat çatışmır: 2 kq tələb olunur.').waitFor()
  await row(10).getByText('Tomat: 1 kq mövcuddur.').waitFor()
  assert.match(await row(10).locator('.kitchen-queue-state > span').innerText(), /Qəbul/)
  assert.equal(postCounts.get(10), 1)
  await page.screenshot({ path: path.join(dist, 'kitchen-stock-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'kitchen-stock-mobile.png'), fullPage: true })

  const secondButton = row(11).getByRole('button', { name: 'Hazırlamağa başla' })
  await secondButton.click()
  const busyButton = row(11).getByRole('button', { name: 'İcra olunur' })
  await busyButton.waitFor()
  assert.equal(await busyButton.isDisabled(), true)
  await busyButton.evaluate((button) => button.click())
  await row(11).getByRole('button', { name: 'Hazırdır' }).waitFor()
  assert.equal(postCounts.get(11), 1)
  assert.match(await row(10).locator('.kitchen-queue-state > span').innerText(), /Qəbul/)

  await row(12).getByRole('button', { name: 'Hazırlamağa başla' }).click()
  await row(12).getByRole('button', { name: /Təkrar: Hazırlamağa başla/ }).waitFor()
  await row(12).getByRole('button', { name: /Təkrar: Hazırlamağa başla/ }).click()
  await row(12).getByRole('button', { name: 'Hazırdır' }).waitFor()
  assert.equal(postCounts.get(12), 2)

  await row(13).getByRole('button', { name: 'Hazırlamağa başla' }).click()
  await row(13).getByRole('button', { name: 'Hazırdır' }).waitFor()
  assert.equal(await row(13).getByRole('button', { name: /Təkrar: Hazırlamağa başla/ }).count(), 0)
  assert.equal(postCounts.get(13), 1)

  await row(14).getByRole('button', { name: 'Hazırlamağa başla' }).click()
  await row(14).getByText('Resept düzgün qurulmayıb. Menecer yoxlasın.').waitFor()
  await row(15).getByRole('button', { name: 'Hazırlamağa başla' }).click()
  await row(15).getByText('Stok uçotu uyğun deyil. Menecerə müraciət edin.').waitFor()
  for (const id of [14, 15]) {
    assert.match(await row(id).locator('.kitchen-queue-state > span').innerText(), /Qəbul/)
    assert.equal(postCounts.get(id), 1)
  }

  await row(10).getByRole('button', { name: 'Hazırlamağa başla' }).click()
  await row(10).getByRole('button', { name: 'Hazırdır' }).waitFor()
  assert.equal(await row(10).getByText('Tomat çatışmır: 2 kq tələb olunur.').count(), 0)
  assert.equal(postCounts.get(10), 2)
  assert.deepEqual(pageErrors, [])
  console.log('Kitchen recipe stock smoke passed')
} finally {
  await browser.close()
}
