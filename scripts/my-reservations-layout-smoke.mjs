import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'Test', surname: 'Customer', roleId: '5' })).toString('base64url')}.signature`
const statuses = ['Completed', 'Completed', 'PendingPayment', 'Confirmed', 'Cancelled', 'NoShow', 'Expired', 'PaymentSubmitted', 'AwaitingPaymentInstruction', 'Seated']
const records = Array.from({ length: 51 }, (_, i) => ({
  id: 109 - i, restaurantId: 1, tableId: i + 1, restaurantName: i === 3 ? 'Dolce Vita Port Baku Neftchilar Avenue Private Dining Restaurant' : 'Dolce Vita Port Baku', tableName: `Masa-${i + 1}`,
  reservedAt: '2026-11-04T07:30:00Z', expectedArrivalAt: i === 1 ? '2026-11-04T07:45:00Z' : null,
  timeZone: 'Asia/Baku', peopleCount: 2, status: statuses[i % statuses.length], depositAmount: i === 0 ? 0 : 20,
  holdExpiresAt: [0, 2].includes(i) ? '2026-11-04T07:40:00Z' : null,
  restaurantResponseExpiresAt: i === 8 ? '2026-11-04T07:50:00Z' : null,
}))
records[10].status = 'CONFIRMED'
records[11].status = 'TƏSDİQLƏNİB'
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const errors = []

try {
  for (const language of ['az', 'en', 'ru']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' })
    await context.addInitScript(language => localStorage.setItem('ecafe.language', language), language)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    const state = { queries: [], delay: 250, failNext: false }
    await page.route(`${origin}/**`, async route => {
      const url = new URL(route.request().url())
      const pathname = url.pathname
      if (pathname.startsWith('/api/v1/')) {
        if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
        if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'Test', surname: 'Customer', roleId: 5, isActive: true })
        if (pathname === '/api/v1/localization/preference') return json(route, { language })
        if (pathname.includes('/localization/dictionaries/')) return json(route, { language, version: 'v1', fallbackLanguage: 'az', messages: {} })
        if (pathname === '/api/v1/public/reservations/my') {
          state.queries.push(Object.fromEntries(url.searchParams))
          await new Promise(resolve => setTimeout(resolve, state.delay))
          if (state.failNext) { state.failNext = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test connection error' }) }) }
          const index = Number(url.searchParams.get('PageNumber') || 1)
          const size = Number(url.searchParams.get('PageSize') || 10)
          const query = (url.searchParams.get('RestaurantName') || '').toLowerCase()
          const date = url.searchParams.get('ReservedDate')?.slice(0, 10)
          const filtered = records.filter(record => record.restaurantName.toLowerCase().includes(query) && (!date || date === record.reservedAt.slice(0, 10)))
          return json(route, { items: filtered.slice((index - 1) * size, index * size), totalCount: filtered.length, pageIndex: index, totalPages: Math.max(1, Math.ceil(filtered.length / size)), hasNextPage: index * size < filtered.length, hasPreviousPage: index > 1 })
        }
        if (pathname.endsWith('/notifications')) return json(route, { items: [], totalCount: 0 })
        if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
        return json(route, {})
      }
      const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
      if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream' })
    })
    await page.goto(`${origin}/reservations`)
    await page.locator('.customer-reservation-card').first().waitFor()
    assert.equal(await page.locator('.customer-reservation-card').count(), 10)
    const completed = page.locator('.customer-reservation-card').filter({ has: page.locator('#reservation-title-109') })
    assert.equal(await completed.locator('.my-reservation-deadline').count(), 0)
    assert.equal(await completed.locator('time').count(), 1)
    assert.match(await completed.locator('time').innerText(), /11:30/)
    const adjusted = page.locator('.customer-reservation-card').filter({ has: page.locator('#reservation-title-108') })
    assert.match(await adjusted.locator('time').innerText(), /11:45/)
    assert.match(await adjusted.locator('dd small').innerText(), /11:30/)
    assert.equal(await page.locator('.my-reservation-deadline').count(), 2)
    assert.equal(await page.locator('.my-reservation-details').first().getAttribute('href'), '/confirmation?reservationId=109')
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport)
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${language} ${viewport.width} ${theme}: no horizontal overflow`)
        for (const target of ['.my-reservations-refresh', '.my-reservation-details', '.pagination-arrow']) {
          const box = await page.locator(target).first().boundingBox()
          assert.ok(box.width >= 44 && box.height >= 44)
        }
        const card = await completed.boundingBox()
        if (viewport.width >= 1000) assert.ok(card.height < 200, `Compact desktop card: ${card.height}`)
        await page.screenshot({ path: path.join(dist, `my-reservations-${language}-${viewport.width}-${theme}.png`), fullPage: true })
        if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({ path: path.join(dist, `my-reservations-viewport-${language}-${viewport.width}-${theme}.png`) })
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await completed.evaluate(node => { node.dataset.identity = 'stable' })
    state.delay = 450
    await page.locator('.my-reservations-refresh').click()
    assert.equal(await completed.getAttribute('data-identity'), 'stable')
    assert.equal(await page.locator('.my-reservations-loading').count(), 0)
    await page.waitForFunction(() => !document.querySelector('.my-reservations-refresh').disabled)
    assert.equal(await completed.getAttribute('data-identity'), 'stable')
    state.failNext = true
    await page.locator('.my-reservations-refresh').click()
    await page.getByText('Test connection error', { exact: true }).waitFor()
    assert.equal(await page.locator('.customer-reservation-card').count(), 10)
    await page.locator('.my-reservations-refresh').click()
    await page.waitForFunction(() => !document.querySelector('.my-reservations-refresh').disabled)
    await page.locator('.pagination-page').filter({ hasText: /^2$/ }).click()
    await page.waitForFunction(() => document.querySelector('.pagination-page[aria-current="page"]')?.textContent === '2')
    assert.equal(state.queries.at(-1).PageNumber, '2')
    await page.locator('#my-reservations-restaurant-name').fill('NeFtChIlAr')
    await page.waitForFunction(() => document.querySelectorAll('.customer-reservation-card').length === 1)
    assert.equal(state.queries.at(-1).RestaurantName, 'NeFtChIlAr')
    assert.equal(state.queries.at(-1).PageNumber, '1')
    await page.locator('input[type="date"]').fill('2026-11-05')
    await page.locator('.reservation-empty-state').waitFor()
    assert.match(state.queries.at(-1).ReservedDate, /^2026-11-05/)
    await page.locator('.my-reservations-clear').click()
    await page.waitForFunction(() => document.querySelectorAll('.customer-reservation-card').length === 10)
    await page.locator('.pagination-size-select').selectOption('20')
    await page.waitForFunction(() => document.querySelectorAll('.customer-reservation-card').length === 20)
    assert.equal(state.queries.at(-1).PageSize, '20')
    assert.equal(state.queries.at(-1).PageNumber, '1')
    for (const id of [99, 98]) {
      const card = page.locator('.customer-reservation-card').filter({ has: page.locator(`#reservation-title-${id}`) })
      assert.equal(await card.locator('.ui-badge-success').count(), 1)
      assert.doesNotMatch(await card.locator('.ui-badge').innerText(), /CONFIRMED|TƏSDİQLƏNİB/)
    }
    await context.close()
  }
  assert.deepEqual(errors, [])
  console.log('My reservations layout smoke passed: AZ/EN/RU, six viewports, both themes, time zones, updated arrivals, deadlines, pagination, search, date, empty/error states and silent refresh')
} finally { await browser.close() }
