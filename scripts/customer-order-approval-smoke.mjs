import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://localhost:53219'
const dist = path.resolve('dist')
const now = '2026-11-02T18:00:00Z'
const state = { posts: [], sent: false, aborted: false, customerGets: 0, waiterPosts: 0, kitchenGets: 0, menuPrice: 7, menuAvailable: true, deferNextPost: false, resolvePost: null }
const session = { id: 21, restaurantId: 1, restaurantName: 'Test Restaurant', tableId: 1, tableName: 'Masa-1',
  reservationId: null, statusId: 7001, openedAt: now, closedAt: null, timeZone: 'Asia/Baku', canCreateOrder: true }

function token(roleId) {
  return `header.${Buffer.from(JSON.stringify({ userId: String(roleId), name: 'Test', surname: 'User', roleId: String(roleId), restaurantId: roleId === 5 ? null : '1', restaurantRoles: roleId === 5 ? [] : [`1:${roleId}`] })).toString('base64url')}.signature`
}

function json(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function asset(route, pathname) {
  const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
  if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
}

function order(customer = false) {
  return { id: 501, restaurantId: 1, tableId: 1, tableSessionId: 21, reservationId: null, waiterUserId: null, sourceId: 1,
    statusId: state.sent ? 2001 : 2009, openedAt: now, sentToKitchenAt: state.sent ? now : null,
    acceptedAt: null, preparingAt: null, readyAt: null, servedAt: null, closedAt: null, cancelledAt: null,
    canCancel: !state.sent, canMarkServed: false, canRequestCancellation: false, canForwardCancellationRequest: false,
    cancellationRequest: null, cancellationReason: null, subtotal: 7, note: customer ? undefined : 'Less sugar',
    items: [{ id: 701, itemId: 5, name: 'Tea', quantity: 1, unitPrice: 7, lineTotal: 7, note: customer ? undefined : 'Hot' }],
  }
}

async function openPage(browser, roleId, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token(roleId) })
    if (pathname === '/api/v1/profile') return json(route, { userId: String(roleId), name: 'Test', surname: 'User', roleId, restaurantId: roleId === 5 ? null : 1, isActive: true,
      profiles: [{ restaurantId: roleId === 5 ? null : 1, restaurantName: 'Test Restaurant', roleId, roleName: roleId === 5 ? 'Customer' : roleId === 4 ? 'Waiter' : 'Kitchen', isActive: true }] })
    if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    if (pathname === '/api/v1/public/table-sessions/my') return json(route, { items: [session, { ...session, id: 22, statusId: 7002, closedAt: now, canCreateOrder: false }], pageIndex: 1, totalPages: 1, totalCount: 2 })
    if (pathname === '/api/v1/public/table-sessions/21') return json(route, session)
    if (pathname === '/api/v1/public/table-sessions/22') return json(route, { ...session, id: 22, statusId: 7002, closedAt: now, canCreateOrder: false })
    if (pathname === '/api/v1/public/table-sessions/23') return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ statusCode: 404, message: 'Not found' }) })
    if (pathname === '/api/v1/public/table-sessions/21/orders' && request.method() === 'GET') {
      state.customerGets++
      return json(route, { items: state.posts.length ? [order(true)] : [], pageIndex: 1, totalPages: 1, totalCount: state.posts.length ? 1 : 0 })
    }
    if (pathname === '/api/v1/public/table-sessions/21/orders' && request.method() === 'POST') {
      state.posts.push({ key: request.headers()['idempotency-key'], body: request.postData() })
      if (!state.aborted) { state.aborted = true; return route.abort('failed') }
      if (state.deferNextPost) {
        state.deferNextPost = false
        await new Promise((resolve) => { state.resolvePost = resolve })
      }
      return json(route, order(true))
    }
    if (pathname === '/api/v1/public/table-sessions/22/orders') return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname === '/api/v1/public/table-sessions/21/orders/501') return json(route, order(true))
    if (pathname === '/api/v1/public/restaurants/1/menu') return json(route, [{ id: 1, name: 'Drinks', isActive: true, items: [{ id: 5, name: 'Tea', price: state.menuPrice, isActive: state.menuAvailable }] }])
    if (pathname === '/api/v1/table-sessions/21/bill' || pathname === '/api/v1/table-sessions/22/bill') return json(route, { tableSessionId: pathname.includes('/22/') ? 22 : 21, restaurantId: 1, currencyCode: 'AZN', totalAmount: 0, depositCreditAmount: 0, paidAmount: 0, remainingAmount: 0, hasUnservedOrders: state.posts.length > 0, isOpen: true, enabled: true, isTest: true, canPay: false, canClose: false, latestPayment: null })
    if (pathname === '/api/v1/restaurants/1/table-sessions/mine/21') return json(route, { id: 21, restaurantId: 1, tableId: 1, tableNo: 1, tableName: 'Masa-1', tableCapacity: 4, statusId: 1001, reservationId: null, customerName: 'Customer', peopleCount: 2, openedAt: now, timeZone: 'Asia/Baku', unsentOrderCount: state.sent ? 0 : 1 })
    if (pathname === '/api/v1/restaurants/1/table-sessions/21/orders' && request.method() === 'GET') return json(route, { items: state.posts.length ? [order()] : [], pageIndex: 1, totalPages: 1, totalCount: state.posts.length ? 1 : 0 })
    if (pathname === '/api/v1/restaurants/1/table-sessions/21/orders/501') return json(route, order())
    if (pathname === '/api/v1/restaurants/1/table-sessions/21/orders/501/send-to-kitchen' && request.method() === 'POST') {
      state.waiterPosts++
      state.sent = true
      return json(route, order())
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders') { state.kitchenGets++; return json(route, { items: state.sent ? [{ ...order(), tableName: 'Masa-1', timeZone: 'Asia/Baku', canAccept: true }] : [], pageIndex: 1, totalPages: 1, totalCount: state.sent ? 1 : 0 }) }
    return json(route, {})
  })
  return { context, page, errors }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const customer = await openPage(browser, 5, { width: 390, height: 844 })
  await customer.page.goto(`${origin}/orders?sessionId=21`)
  await customer.page.getByRole('button', { name: 'Yeni sifariş', exact: true }).click()
  const addItem = customer.page.getByRole('button', { name: 'Tea əlavə et' })
  const submit = customer.page.getByRole('button', { name: 'Sifarişi ofisianta göndər' })
  await addItem.waitFor()
  assert.equal(await submit.isDisabled(), true)
  assert.ok(await submit.evaluate((button) => Number(getComputedStyle(button).opacity) < 1))
  await addItem.click()
  assert.equal(await submit.isEnabled(), true)
  assert.equal(await submit.evaluate((button) => getComputedStyle(button).opacity), '1')
  await customer.page.getByRole('button', { name: 'Tea sil' }).click()
  assert.equal(await submit.isDisabled(), true)
  assert.equal(state.posts.length, 0)
  await addItem.click()
  await customer.page.screenshot({ path: path.join(dist, 'customer-order-composer-390.png') })
  await submit.click()
  await customer.page.getByText('Yeni sifariş yaratmayın. Yalnız eyni cəhdi yoxlayın.').first().waitFor()
  assert.equal(state.posts.length, 1)
  assert.equal(await customer.page.getByRole('button', { name: 'Sifarişi ofisianta göndər' }).isDisabled(), true)
  await customer.page.getByRole('button', { name: 'Eyni cəhdi yoxla' }).click()
  await customer.page.getByText('Sifariş #501 ofisiantın təsdiqinə göndərildi.').waitFor()
  assert.equal(state.posts.length, 2)

  const conflict = await openPage(browser, 5, { width: 390, height: 844 })
  await conflict.page.goto(`${origin}/orders?sessionId=21`)
  await conflict.page.getByRole('button', { name: 'Yeni sifariş', exact: true }).click()
  await conflict.page.getByRole('button', { name: 'Tea əlavə et' }).click()
  state.menuPrice = 8
  await conflict.page.getByRole('button', { name: 'Menyunu yenilə' }).click()
  await conflict.page.getByText('8.00 AZN').first().waitFor()
  await conflict.page.getByRole('button', { name: 'Sifarişi ofisianta göndər' }).click()
  await conflict.page.getByText('Menyu dəyişib. Məhsulları və qiymətləri yenidən yoxlayın.').first().waitFor()
  assert.equal(await conflict.page.locator('.customer-order-compose-cart').getByText('7.00 AZN').count() > 0, true)
  await conflict.page.getByRole('button', { name: 'Yeni qiymətləri qəbul et' }).click()
  await conflict.page.getByText('Qiymətlər yeniləndi. Məhsulları təsdiqləyin.').waitFor()
  assert.equal(await conflict.page.locator('.customer-order-compose-cart').getByText('7.00 AZN').count(), 0)
  state.menuAvailable = false
  await conflict.page.getByRole('button', { name: 'Menyunu yenilə' }).click()
  await conflict.page.getByText('Menyuda mövcud deyil').waitFor()
  await conflict.page.getByRole('button', { name: 'Sifarişi ofisianta göndər' }).click()
  await conflict.page.getByText('Menyuda olmayan məhsulları səbətdən silin, sonra yeni qiymətləri təsdiqləyin.').waitFor()
  assert.equal(await conflict.page.getByRole('button', { name: 'Yeni qiymətləri qəbul et' }).isDisabled(), true)
  await conflict.page.screenshot({ path: path.join(dist, 'customer-order-unavailable-390.png') })
  await conflict.page.getByRole('button', { name: 'Tea sil' }).click()
  assert.equal(await conflict.page.getByRole('button', { name: 'Yeni qiymətləri qəbul et' }).isEnabled(), true)
  assert.equal(state.posts.length, 2)
  assert.deepEqual(conflict.errors, [])
  await conflict.context.close()

  state.menuAvailable = true
  const navigation = await openPage(browser, 5, { width: 390, height: 844 })
  await navigation.page.goto(`${origin}/orders?sessionId=21`)
  await navigation.page.getByRole('button', { name: 'Yeni sifariş', exact: true }).click()
  await navigation.page.getByRole('button', { name: 'Tea əlavə et' }).click()
  state.deferNextPost = true
  await navigation.page.getByRole('button', { name: 'Sifarişi ofisianta göndər' }).click()
  for (let attempt = 0; !state.resolvePost && attempt < 50; attempt++) await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(typeof state.resolvePost, 'function')
  await navigation.page.locator('#customer-order-session-select').selectOption('22')
  const lateResponse = navigation.page.waitForResponse((response) => response.url().endsWith('/api/v1/public/table-sessions/21/orders') && response.request().method() === 'POST')
  state.resolvePost()
  await lateResponse
  await navigation.page.getByText('Bu sessiyada hələ sifariş yoxdur').waitFor()
  assert.equal(await navigation.page.getByText('Sifariş #501 ofisiantın təsdiqinə göndərildi.').count(), 0)
  assert.deepEqual(navigation.errors, [])
  await navigation.context.close()
  assert.deepEqual(state.posts[0], state.posts[1])
  await customer.page.getByText('Ofisiantın təsdiqi gözlənilir').first().waitFor()
  assert.equal(await customer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await customer.page.screenshot({ path: path.join(dist, 'customer-order-pending-390.png'), fullPage: true })

  const kitchen = await openPage(browser, 6, { width: 1280, height: 850 })
  await kitchen.page.goto(`${origin}/kitchen`)
  await kitchen.page.waitForFunction(() => document.querySelector('.kitchen-queue-row, .kitchen-queue-empty') !== null)
  assert.equal(await kitchen.page.locator('.kitchen-queue-row').count(), 0)

  const waiter = await openPage(browser, 4, { width: 1280, height: 850 })
  await waiter.page.goto(`${origin}/waiter/restaurants/1/sessions/21/orders`)
  const row = waiter.page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #501' })
  await row.waitFor()
  assert.equal(await row.getByText('Ofisiantın təsdiqi gözlənilir').count(), 1)
  await row.getByRole('button', { name: 'Təsdiqlə və mətbəxə göndər' }).click()
  await waiter.page.getByText('Sifariş #501 təsdiqlənib mətbəxə göndərildi.').waitFor()
  assert.equal(state.waiterPosts, 1)
  await kitchen.page.reload()
  await kitchen.page.locator('.kitchen-queue-row').first().waitFor()
  await customer.page.getByRole('button', { name: 'Sifarişləri yenilə' }).click()
  await customer.page.getByText('Mətbəxdə gözləyir').first().waitFor()
  await waiter.page.screenshot({ path: path.join(dist, 'waiter-customer-approval-1280.png') })
  assert.equal(await waiter.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)

  await customer.page.locator('#customer-order-session-select').selectOption('22')
  await customer.page.getByText('Bu sessiyada hələ sifariş yoxdur').waitFor()
  assert.equal(await customer.page.getByRole('button', { name: 'Yeni sifariş', exact: true }).count(), 0)
  await customer.page.goto(`${origin}/orders?sessionId=23`)
  await customer.page.getByText('Sessiya əlçatan deyil').waitFor()
  assert.equal(state.posts.length, 3)
  assert.deepEqual(customer.errors, [])
  assert.deepEqual(waiter.errors, [])
  assert.deepEqual(kitchen.errors, [])
  await customer.context.close()
  await waiter.context.close()
  await kitchen.context.close()
  console.log('Customer create/retry, waiter approval, kitchen isolation, and session guards passed')
} finally {
  await browser.close()
}
