import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Customer', email: 'qa@example.com', roleId: '5', roleName: 'Customer' })).toString('base64url')}.signature`
const managerToken = `header.${Buffer.from(JSON.stringify({ userId: '43', name: 'QA', surname: 'Manager', email: 'manager@example.com', roleId: '3', roleName: 'Manager', restaurantId: '1' })).toString('base64url')}.signature`
const tableRequests = []

function json(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  await context.addInitScript(() => window.localStorage.setItem('ecafe.language', 'en'))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    if (pathname.startsWith('/api/v1/')) {
      if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
      if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Customer', roleId: 5, isActive: true })
      if (pathname === '/api/v1/localization/preference') return json(route, { language: 'en' })
      if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) {
        const language = pathname.split('/').at(-1)
        return json(route, { language, version: 'v1', fallbackLanguage: 'az', messages: language === 'en' ? {
          'ui.count.guests_one': '{{count}} guest',
          'ui.count.guests_other': '{{count}} guests',
        } : {} })
      }
      if (pathname === '/api/v1/public/restaurants/1') return json(route, { id: 1, name: 'Test Restaurant', location: 'Baku', phone: '+994501234567', isOpen: true, hasActiveContract: true })
      if (pathname === '/api/v1/public/restaurants/1/tables') {
        tableRequests.push(route.request().headers()['accept-language'])
        return json(route, [
          { id: 1, restaurantId: 1, tableNo: 1, name: 'Table-1', capacity: 1, isEmpty: true },
          { id: 2, restaurantId: 1, tableNo: 2, name: 'Masa-2', capacity: 2, isEmpty: true },
          { id: 3, restaurantId: 1, tableNo: 3, name: 'Custom corner', capacity: 5, isEmpty: true },
        ])
      }
      if (pathname === '/api/v1/public/restaurants/1/menu') return json(route, { categories: [], items: [] })
      if (pathname === '/api/v1/public/reservations/77') return json(route, {
        id: 77, restaurantId: 1, tableId: 1, reservedAt: '2026-10-18T07:00:00Z',
        peopleCount: 2, status: 'Confirmed', statusId: 4, depositAmount: 0,
        restaurantName: 'Test Restaurant', tableName: 'Table-1',
      })
      if (pathname === '/api/v1/public/reservations/77/history') return json(route, {
        reservationId: 77, items: [{ id: 1, toStatus: 'Confirmed', changedAt: '2026-10-18T07:00:00Z',
          actorType: 'System', reason: 'Depozitsiz rezervasiya avtomatik təsdiqləndi.',
          reasonLabel: 'The reservation was automatically confirmed without a deposit.' }],
      })
      if (pathname === '/api/v1/public/reservations/77/late-arrival') return json(route, { canRequest: false, arrivalChoices: [], timeZone: 'Asia/Baku' })
      if (pathname === '/api/v1/public/reservations/77/refund') return json(route, null)
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })

  await page.goto(`${origin}/restaurants/1`)
  await page.getByText('Table 1 · 1 guest', { exact: true }).waitFor()
  await page.getByText('Table 2 · 2 guests', { exact: true }).waitFor()
  await page.getByText('Table 3 · 5 guests', { exact: true }).waitFor()
  await page.getByText('Masa-2', { exact: true }).waitFor()
  assert.deepEqual(tableRequests, ['en'])
  await page.screenshot({ path: path.join(dist, 'localization-display-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'localization-display-mobile.png'), fullPage: true })
  await page.goto(`${origin}/restaurants/1/reserve`)
  await page.getByText('2 guests', { exact: true }).waitFor()
  assert.equal(await page.getByText('ui.count.guests').count(), 0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.goto(`${origin}/confirmation?reservationId=77`)
  await page.waitForTimeout(1000)
  assert.deepEqual(pageErrors, [])
  await page.getByText('The reservation was automatically confirmed without a deposit.').waitFor()
  assert.equal(await page.getByText('Depozitsiz rezervasiya avtomatik təsdiqləndi.').count(), 0)
  assert.deepEqual(pageErrors, [])

  const managerContext = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  await managerContext.addInitScript(() => window.localStorage.setItem('ecafe.language', 'az'))
  const managerPage = await managerContext.newPage()
  const managerErrors = []
  const managerLanguages = { tables: [], reservations: [] }
  managerPage.on('pageerror', (error) => managerErrors.push(error.message))
  await managerPage.route(`${origin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.startsWith('/api/v1/')) {
      const language = route.request().headers()['accept-language'] || 'az'
      if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: managerToken })
      if (pathname === '/api/v1/profile') return json(route, { userId: '43', name: 'QA', surname: 'Manager', roleId: 3, isActive: true, restaurantId: 1 })
      if (pathname === '/api/v1/localization/preference') return json(route, { language })
      if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) return json(route, { language: pathname.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
      if (pathname === '/api/v1/restaurants/getAll') return json(route, [{ id: 1, name: 'Test Restaurant', location: 'Baku', hasActiveContract: true, isActive: true }])
      if (pathname === '/api/v1/restaurants/1/tables') {
        managerLanguages.tables.push(language)
        return json(route, [{ id: 1, restaurantId: 1, tableNo: 1, name: language === 'en' ? 'Table-1' : 'Masa-1', capacity: 2, isEmpty: true }])
      }
      if (pathname === '/api/v1/restaurants/1/reservations') {
        managerLanguages.reservations.push(language)
        return json(route, { items: [{ id: 77, restaurantId: 1, restaurantName: 'Test Restaurant', tableId: 1,
          tableName: language === 'en' ? 'Table-1' : 'Masa-1', customerName: 'QA Customer',
          reservedAt: '2026-10-18T07:00:00Z', peopleCount: 2, status: 'Confirmed', statusId: 4, depositAmount: 0 }],
          pageIndex: 1, totalPages: 1, totalCount: 1 })
      }
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  await managerPage.goto(`${origin}/admin/reservations`)
  await managerPage.locator('#reservation-table-filter option', { hasText: 'Masa-1' }).waitFor({ state: 'attached' })
  await managerPage.getByText('Test Restaurant · Masa-1').waitFor()
  await managerPage.getByRole('button', { name: /Dil: Azərbaycanca/ }).click()
  await managerPage.getByRole('button', { name: 'English' }).click()
  await managerPage.locator('#reservation-table-filter option', { hasText: 'Table-1' }).waitFor({ state: 'attached' })
  await managerPage.getByText('Test Restaurant · Table-1').waitFor()
  await managerPage.getByRole('button', { name: /Language: English/ }).click()
  await managerPage.getByRole('button', { name: 'Azərbaycanca' }).click()
  await managerPage.locator('#reservation-table-filter option', { hasText: 'Masa-1' }).waitFor({ state: 'attached' })
  await managerPage.getByText('Test Restaurant · Masa-1').waitFor()
  assert.ok(managerLanguages.tables.includes('en'))
  assert.ok(managerLanguages.reservations.includes('en'))
  assert.deepEqual(managerErrors, [])
  console.log('Localization display smoke passed')
} finally {
  await browser.close()
}
