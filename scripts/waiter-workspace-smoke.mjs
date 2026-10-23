import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://localhost:5209'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Waiter', roleId: '4', restaurantId: '1', restaurantRoles: ['1:4'] })).toString('base64url')}.signature`
const time = '2026-10-23T10:00:00Z'
let readyServed = false
let servePosts = 0
let rowServePosts = 0
let rowSendPosts = 0
let rowServed = false
let rowSent = false
let createPosts = 0
let delayedCreate = false
let pendingPayment = false
let completePosts = 0
const pageErrors = []

function json(route, data, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function session(id) {
  return { id, restaurantId: 1, tableId: id, tableNo: id, tableName: `Masa-${id}`, tableCapacity: 4,
    statusId: 1001, reservationId: id === 11 ? 31 : null, customerName: id === 11 ? 'Test customer' : null,
    peopleCount: 2, openedAt: time, mustVacateAt: null, requiresCloseReview: false,
    closeReviewDueAt: null, closeReviewConfirmedAt: null, timeZone: 'Asia/Baku',
    readyOrderCount: id === 11 ? 4 : 0, unsentOrderCount: id === 11 ? 1 : 0 }
}

function order(id) {
  const statusId = id === 501 ? readyServed ? 2005 : 2004 : id === 505 ? rowServed ? 2005 : 2004 : [506, 507].includes(id) ? 2004 : id === 502 ? rowSent ? 2002 : 2001 : 2005
  return { id, restaurantId: 1, tableId: 11, tableSessionId: 11, reservationId: 31,
    waiterUserId: 42, sourceId: 1, statusId, openedAt: time,
    sentToKitchenAt: id === 502 && !rowSent ? null : time, servedAt: statusId === 2005 ? time : null,
    canMarkServed: statusId === 2004, subtotal: 5, note: id === 502 ? 'Pəncərə yanında' : null,
    items: [{ id, itemId: 1, name: 'Tea', quantity: 1, unitPrice: 5, lineTotal: 5, note: id === 502 ? 'Şəkərsiz' : null }] }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    if (pathname.startsWith('/api/v1/')) {
      if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
      if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Waiter', roleId: 4, restaurantId: 1,
        isActive: true, profiles: [{ restaurantId: 1, restaurantName: 'Test Restaurant', roleId: 4, roleName: 'Waiter', isActive: true }] })
      if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
      if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) return json(route, { language: pathname.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
      if (pathname === '/api/v1/restaurants/1/table-sessions/mine') return json(route, { items: [session(11), session(12)], pageIndex: 1, totalPages: 1, totalCount: 2 })
      if (pathname === '/api/v1/restaurants/1/table-sessions/mine/ready-orders') return json(route, { items: [501, 505, 506, 507].map((id) => ({ order: id === 501 && readyServed ? { ...order(501), statusId: 2004, servedAt: null, canMarkServed: true } : order(id), tableName: 'Masa-11', tableNo: 11, timeZone: 'Asia/Baku', readyAt: time })), pageIndex: 1, totalPages: 1, totalCount: 4 })
      if (pathname === '/api/v1/restaurants/1/table-sessions/mine/11') return json(route, session(11))
      if (pathname === '/api/v1/restaurants/1/table-sessions/mine/12') return json(route, session(12))
      if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders' && request.method() === 'GET') return json(route, { items: [order(503), order(502), order(505)], pageIndex: 1, totalPages: 2, totalCount: 21 })
      if (pathname === '/api/v1/restaurants/1/table-sessions/12/orders' && request.method() === 'GET') return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (/^\/api\/v1\/restaurants\/1\/table-sessions\/11\/orders\/\d+$/.test(pathname)) return json(route, order(Number(pathname.split('/').at(-1))))
      if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders/501/serve' && request.method() === 'POST') {
        servePosts++
        if (servePosts === 1) { await new Promise((resolve) => setTimeout(resolve, 250)); readyServed = true; return route.abort('failed') }
        readyServed = true
        return json(route, order(501))
      }
      if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders/502/send-to-kitchen' && request.method() === 'POST') {
        rowSendPosts++
        if (rowSendPosts === 1) { await new Promise((resolve) => setTimeout(resolve, 250)); return route.abort('failed') }
        rowSent = true
        return json(route, order(502))
      }
      if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders/505/serve' && request.method() === 'POST') {
        rowServePosts++
        if (rowServePosts === 1) { await new Promise((resolve) => setTimeout(resolve, 250)); return route.abort('failed') }
        rowServed = true
        return json(route, order(505))
      }
      if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders' && request.method() === 'POST') {
        createPosts++
        assert.equal(request.headers()['idempotency-key']?.length > 0, true)
        if (delayedCreate) await new Promise((resolve) => setTimeout(resolve, 350))
        return json(route, { ...order(504), id: 504, statusId: 2001, sentToKitchenAt: null, servedAt: null, canMarkServed: false })
      }
      if (pathname.includes('/complete-service') && request.method() === 'POST') { completePosts++; return json(route, {}) }
      if (pathname === '/api/v1/public/restaurants/1/menu') return json(route, [{ id: 1, name: 'Drinks', isActive: true, items: [{ id: 1, name: 'Tea', price: 5, isActive: true }] }])
      if (pathname === '/api/v1/table-sessions/11/bill' || pathname === '/api/v1/table-sessions/12/bill') {
        const pending = pathname.includes('/12/')
        return json(route, { tableSessionId: pending ? 12 : 11, restaurantId: 1, reservationId: pending ? null : 31,
          currencyCode: 'AZN', totalAmount: 10, depositCreditAmount: 0, paidAmount: 0, remainingAmount: 10,
          hasUnservedOrders: false, isOpen: true, enabled: true, isTest: true, canPay: false, canClose: false,
          latestPayment: pending && pendingPayment ? { id: 1, tableSessionId: 12, amount: 10, currencyCode: 'AZN', statusId: 3001, status: 'Pending', isTest: true, requiresRefund: false } : null })
      }
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })

  await page.goto(`${origin}/waiter?view=tables`)
  await page.locator('.waiter-session-row').first().waitFor()
  assert.equal(await page.locator('.waiter-session-row').count(), 2)
  assert.match(await page.locator('.waiter-session-row').first().innerText(), /Hazır: 4/)
  assert.equal(await page.locator('.waiter-ready-row').count(), 0)
  await page.screenshot({ path: path.join(dist, 'waiter-tables-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'waiter-tables-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 320, height: 700 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'waiter-tables-narrow.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Hazır sifarişlər/ }).click()
  assert.equal(await page.locator('.waiter-ready-row').count(), 4)
  assert.match(await page.locator('.waiter-ready-row').first().getByRole('link').getAttribute('href') || '', /orderId=501/)
  await page.screenshot({ path: path.join(dist, 'waiter-ready-mobile.png'), fullPage: true })
  await page.locator('.waiter-ready-row').first().getByRole('link').click()
  await page.waitForURL(/orderId=501/)
  await page.locator('.waiter-orders-detail').waitFor()
  const offPageRow = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #501' })
  assert.equal(await offPageRow.count(), 1)
  assert.equal(await offPageRow.getByRole('button', { name: 'Təqdim et', exact: true }).count(), 1)
  assert.equal(await page.locator('.waiter-orders-detail button').count(), 1)
  await page.setViewportSize({ width: 320, height: 700 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'waiter-order-offpage-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('link', { name: 'Açıq masalar' }).click()
  await page.getByRole('button', { name: /Hazır sifarişlər/ }).click()
  const serveButton = page.locator('.waiter-ready-row').getByRole('button', { name: 'Təqdim et' })
  await serveButton.first().click()
  await page.waitForTimeout(40)
  assert.equal(await serveButton.first().isDisabled(), true)
  await serveButton.first().evaluate((button) => button.click())
  await page.getByRole('button', { name: 'Nəticəni yoxla' }).waitFor()
  assert.equal(servePosts, 1)
  await page.setViewportSize({ width: 320, height: 700 })
  await page.locator('.language-switcher-trigger').click()
  await page.getByRole('button', { name: 'Русский' }).click()
  const russianRetry = page.getByRole('button', { name: 'Проверить результат' })
  await russianRetry.waitFor()
  assert.equal(await russianRetry.evaluate((button) => button.scrollWidth <= button.clientWidth), true)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'waiter-ready-ru-320-unknown.png'), fullPage: true })
  await page.locator('.language-switcher-trigger').click()
  await page.getByRole('button', { name: 'Azərbaycanca' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Nəticəni yoxla' }).click()
  await page.getByText('Sifariş #501 təqdim edildi.').waitFor()
  assert.equal(servePosts, 1)
  assert.equal(await page.locator('.waiter-ready-row').count(), 3)
  assert.equal(await page.locator('.waiter-ready-row').first().innerText().then((value) => value.includes('#501')), false)
  await page.getByRole('button', { name: /Masalar/ }).click()
  await page.locator('.waiter-session-row').first().click()
  await page.waitForURL(/\/waiter\/restaurants\/1\/sessions\/11\/orders/)
  await page.getByRole('group', { name: 'Masa bölmələri' }).waitFor()
  const unsentRow = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #502' })
  await unsentRow.locator('.waiter-order-row-main').click()
  await page.locator('.waiter-orders-detail').getByText('Şəkərsiz').waitFor()
  await page.locator('.waiter-orders-detail').getByText('Pəncərə yanında').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Mətbəxə göndər', exact: true }).count(), 1)
  assert.equal(await page.locator('.waiter-orders-detail button').count(), 1)
  await page.setViewportSize({ width: 1280, height: 850 })
  await page.screenshot({ path: path.join(dist, 'waiter-order-detail-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(dist, 'waiter-order-detail-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Sifariş detalını bağla' }).click()
  assert.equal(await page.locator('.waiter-orders-detail').count(), 0)
  await unsentRow.locator('.waiter-order-row-main').click()
  assert.equal(await page.getByRole('button', { name: 'Mətbəxə göndər', exact: true }).count(), 1)
  await unsentRow.getByRole('button', { name: 'Mətbəxə göndər', exact: true }).click()
  await page.waitForTimeout(40)
  assert.equal(await unsentRow.getByRole('button', { name: 'Göndərilir' }).isDisabled(), true)
  await unsentRow.getByRole('button', { name: 'Göndərilir' }).evaluate((button) => button.click())
  await unsentRow.getByRole('button', { name: 'Eyni sifarişi təkrar göndər' }).waitFor()
  assert.equal(rowSendPosts, 1)
  await unsentRow.getByRole('button', { name: 'Eyni sifarişi təkrar göndər' }).click()
  await page.getByText('Sifariş #502 mətbəxə göndərildi.').waitFor()
  assert.equal(rowSendPosts, 2)
  assert.equal(await unsentRow.getByRole('button', { name: 'Mətbəxə göndər', exact: true }).count(), 0)
  const readyRow = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #505' })
  await readyRow.locator('.waiter-order-row-main').click()
  await page.locator('.waiter-orders-detail .waiter-order-summary-heading span').waitFor()
  assert.match(await page.locator('.waiter-orders-detail .waiter-order-summary-heading span').innerText(), /505/)
  assert.equal(await page.getByRole('button', { name: 'Təqdim et' }).count(), 1)
  assert.equal(await page.locator('.waiter-orders-detail button').count(), 1)
  await readyRow.getByRole('button', { name: 'Təqdim et' }).click()
  await page.waitForTimeout(40)
  assert.equal(await readyRow.getByRole('button', { name: 'Qeyd edilir' }).isDisabled(), true)
  await readyRow.getByRole('button', { name: 'Qeyd edilir' }).evaluate((button) => button.click())
  await readyRow.getByRole('button', { name: 'Nəticəni yoxla' }).waitFor()
  assert.equal(rowServePosts, 1)
  await readyRow.getByRole('button', { name: 'Nəticəni yoxla' }).click()
  await page.getByText('Sifariş #505 təqdim edildi.').waitFor()
  assert.equal(rowServePosts, 2)
  assert.equal(await readyRow.getByRole('button', { name: 'Təqdim et' }).count(), 0)
  await page.screenshot({ path: path.join(dist, 'waiter-workspace-mobile.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.getByRole('button', { name: /^Yeni sifariş/ }).click()
  await page.getByRole('button', { name: 'Tea əlavə et' }).click()
  await page.locator('.waiter-orders-cart-line').waitFor()
  await page.getByRole('link', { name: 'Açıq masalar' }).click()
  await page.locator('.waiter-session-row').first().click()
  await page.getByRole('button', { name: /Yeni sifariş · 1/ }).click()
  assert.equal(await page.locator('.waiter-orders-cart-line').count(), 1)
  await page.getByRole('link', { name: 'Açıq masalar' }).click()
  await page.locator('.waiter-session-row').last().click()
  await page.getByRole('button', { name: /^Yeni sifariş/ }).click()
  assert.equal(await page.locator('.waiter-orders-cart-line').count(), 0)
  await page.getByRole('button', { name: 'Tea əlavə et' }).click()
  assert.equal(await page.locator('.waiter-orders-cart-line').count(), 1)
  await page.getByRole('button', { name: 'Hesab' }).click()
  assert.equal(await page.getByRole('button', { name: 'Xidməti bitir' }).count(), 0)
  await page.getByRole('link', { name: 'Açıq masalar' }).click()
  pendingPayment = true
  await page.locator('.waiter-session-row').last().click()
  await page.getByRole('button', { name: /^Yeni sifariş/ }).click()
  assert.equal(await page.locator('.waiter-orders-cart-line').count(), 1)
  await page.getByText('Ödəniş gözləmədədir').first().waitFor()
  assert.equal(await page.getByRole('button', { name: 'Sifarişi yarat' }).isDisabled(), true)
  assert.equal(createPosts, 0)
  await page.getByRole('link', { name: 'Açıq masalar' }).click()
  pendingPayment = false
  await page.locator('.waiter-session-row').first().click()
  await page.getByRole('button', { name: 'Hesab' }).click()
  assert.equal(await page.getByRole('button', { name: 'Xidməti bitir' }).isDisabled(), true)
  assert.equal(completePosts, 0)
  await page.getByRole('button', { name: /Yeni sifariş · 1/ }).click()
  delayedCreate = true
  await page.getByRole('button', { name: 'Sifarişi yarat' }).click()
  await page.getByRole('link', { name: 'Açıq masalar' }).click()
  await page.waitForTimeout(500)
  await page.locator('.waiter-session-row').first().click()
  await page.getByRole('button', { name: /^Yeni sifariş/ }).click()
  assert.equal(await page.locator('.waiter-orders-cart-line').count(), 0)
  assert.equal(createPosts, 1)
  await page.getByRole('link', { name: 'Açıq masalar' }).click()
  await page.getByRole('button', { name: 'Tünd rejimə keç' }).click()
  await page.waitForTimeout(350)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'waiter-tables-mobile-dark.png'), fullPage: true })
  assert.deepEqual(pageErrors, [])
  console.log('Waiter workspace smoke passed')
} catch (error) {
  console.error('Failure URL:', await browser.contexts()[0]?.pages()[0]?.url())
  console.error('Page errors:', pageErrors)
  const failedPage = browser.contexts()[0]?.pages()[0]
  if (failedPage) await failedPage.screenshot({ path: path.join(dist, 'waiter-workspace-failure.png'), fullPage: true })
  throw error
} finally {
  await browser.close()
}
