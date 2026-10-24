import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const now = '2026-10-25T10:00:00Z'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })

function token(roleId) {
  return `header.${Buffer.from(JSON.stringify({ userId: String(roleId), name: 'Test', surname: 'User', roleId: String(roleId), restaurantId: roleId === 4 ? '1' : null, restaurantRoles: roleId === 4 ? ['1:4'] : [] })).toString('base64url')}.signature`
}

function json(route, data, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function order(id, statusId, customer = false) {
  const cancellable = statusId === 2001 || statusId === 2002
  return {
    id, restaurantId: 1, tableId: 1, tableSessionId: customer ? 21 : 11, reservationId: null,
    waiterUserId: customer ? null : 4, sourceId: 1, statusId, openedAt: now,
    sentToKitchenAt: statusId === 2001 ? null : now, acceptedAt: statusId >= 2002 ? now : null,
    preparingAt: statusId === 2003 ? now : null, readyAt: null, servedAt: null, closedAt: null,
    canMarkServed: false, canCancel: cancellable, cancelledAt: statusId === 2007 ? now : null,
    cancellationReason: statusId === 2007 ? 'Plan dəyişdi' : null,
    subtotal: 7, note: null,
    items: [{ id, itemId: 5, name: 'Tea', quantity: 1, unitPrice: 7, lineTotal: 7, note: null }],
  }
}

function asset(route, pathname) {
  const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
  if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
}

async function runWaiter() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  let status201 = 2001
  let status203 = 2002
  let status204 = 2001
  let status205 = 2001
  let cancel205Posts = 0
  let send204Posts = 0
  let posts = 0
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token(4) })
    if (pathname === '/api/v1/profile') return json(route, { userId: '4', name: 'Test', surname: 'User', roleId: 4, restaurantId: 1, isActive: true, profiles: [{ restaurantId: 1, restaurantName: 'Test Restaurant', roleId: 4, roleName: 'Waiter', isActive: true }] })
    if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname === '/api/v1/restaurants/1/table-sessions/mine/11') return json(route, { id: 11, restaurantId: 1, tableId: 1, tableNo: 1, tableName: 'Masa-1', tableCapacity: 4, statusId: 1001, reservationId: null, customerName: 'Customer', peopleCount: 2, openedAt: now, timeZone: 'Asia/Baku', readyOrderCount: 0, unsentOrderCount: 1 })
    if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders' && request.method() === 'GET') return json(route, { items: [order(201, status201), order(202, 2003), order(203, status203), order(204, status204), order(205, status205)], pageIndex: 1, totalPages: 1, totalCount: 5 })
    if (/^\/api\/v1\/restaurants\/1\/table-sessions\/11\/orders\/\d+$/.test(pathname)) return json(route, order(Number(pathname.split('/').at(-1)), Number(pathname.endsWith('/201') ? status201 : pathname.endsWith('/203') ? status203 : pathname.endsWith('/204') ? status204 : pathname.endsWith('/205') ? status205 : 2003)))
    if (pathname.endsWith('/orders/201/cancel') && request.method() === 'POST') {
      posts++
      assert.deepEqual(JSON.parse(request.postData()), { reason: 'Plan dəyişdi' })
      assert.equal(request.headers()['idempotency-key'], undefined)
      status201 = 2007
      await new Promise((resolve) => setTimeout(resolve, 100))
      return json(route, order(201, 2007))
    }
    if (pathname.endsWith('/orders/203/cancel') && request.method() === 'POST') {
      status203 = 2003
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, code: 'OrderCannotCancel', message: 'Preparation started' }) })
    }
    if (pathname.endsWith('/orders/204/cancel') && request.method() === 'POST') {
      status204 = 2007
      return route.abort('failed')
    }
    if (pathname.endsWith('/orders/204/send-to-kitchen') && request.method() === 'POST') {
      send204Posts++
      await new Promise((resolve) => setTimeout(resolve, 200))
      status204 = 2002
      return json(route, order(204, 2002))
    }
    if (pathname.endsWith('/orders/205/cancel') && request.method() === 'POST') {
      cancel205Posts++
      if (cancel205Posts === 1) return route.abort('failed')
      status205 = 2007
      return json(route, order(205, 2007))
    }
    if (pathname === '/api/v1/public/restaurants/1/menu') return json(route, [])
    if (pathname === '/api/v1/table-sessions/11/bill') return json(route, { tableSessionId: 11, restaurantId: 1, currencyCode: 'AZN', totalAmount: 21, depositCreditAmount: 0, paidAmount: 0, remainingAmount: 21, hasUnservedOrders: false, isOpen: true, enabled: true, isTest: true, canPay: false, canClose: false, latestPayment: null })
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    return json(route, {})
  })
  try {
    await page.goto(`${origin}/waiter/restaurants/1/sessions/11/orders`)
    await page.locator('.waiter-order-row').first().waitFor()
    assert.equal(await page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #202' }).getByRole('button', { name: 'Sifarişi ləğv et' }).count(), 0)
    const row = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #201' })
    await row.getByRole('button', { name: 'Sifarişi ləğv et' }).click()
    await page.getByRole('dialog').waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'order-cancel-reason')
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
    await page.getByRole('dialog').getByRole('button', { name: 'Bağla' }).last().focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('reservation-action-dialog-close')), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.includes('Bağla')), true)
    assert.match(await page.getByRole('dialog').innerText(), /Masa-1/)
    assert.match(await page.getByRole('dialog').innerText(), /Tea/)
    assert.equal(await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).isDisabled(), true)
    await page.locator('#order-cancel-reason').selectOption('planChanged')
    await page.screenshot({ path: path.join(dist, 'order-cancel-waiter-390.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, 'order-cancel-waiter-1440.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await row.getByRole('button', { name: 'Mətbəxə göndər', exact: true }).isDisabled(), true)
    await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).click()
    await page.getByText('Sifariş #201 ləğv edildi.').waitFor()
    assert.equal(posts, 1)
    assert.equal(await row.getByRole('button', { name: 'Sifarişi ləğv et' }).count(), 0)
    const conflict = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #203' })
    await conflict.getByRole('button', { name: 'Sifarişi ləğv et' }).click()
    await page.locator('#order-cancel-reason').selectOption('planChanged')
    await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).click()
    await page.getByText(/artıq ləğv üçün əlçatan deyil/).waitFor()
    assert.equal(await conflict.getByRole('button', { name: 'Sifarişi ləğv et' }).count(), 0)
    const confirmedByGet = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #204' })
    await confirmedByGet.getByRole('button', { name: 'Mətbəxə göndər', exact: true }).click()
    assert.equal(await confirmedByGet.getByRole('button', { name: 'Sifarişi ləğv et' }).isDisabled(), true)
    await page.waitForTimeout(250)
    assert.equal(send204Posts, 1)
    assert.equal(await confirmedByGet.getByRole('button', { name: 'Sifarişi ləğv et' }).isDisabled(), false)
    await confirmedByGet.getByRole('button', { name: 'Sifarişi ləğv et' }).click()
    await page.locator('#order-cancel-reason').selectOption('planChanged')
    await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).click()
    await page.getByText('Sifariş #204 ləğv edildi.').waitFor()
    assert.equal(await confirmedByGet.getByRole('button', { name: 'Sifarişi ləğv et' }).count(), 0)
    await page.locator('.language-switcher-trigger').click()
    await page.locator('.language-switcher-option[lang="en"]').click()
    const pendingCancel = page.locator('.waiter-order-row').filter({ hasText: 'Order #205' })
    await pendingCancel.locator('.waiter-order-cancel-action').click()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'order-cancel-reason')
    await page.locator('#order-cancel-reason').selectOption('planChanged')
    await page.screenshot({ path: path.join(dist, 'order-cancel-waiter-en-390.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.locator('.order-cancel-confirm').click()
    await page.getByText(/result is unknown/i).waitFor()
    assert.equal(await pendingCancel.getByRole('button', { name: /send to kitchen/i }).isDisabled(), true)
    await page.getByRole('dialog').getByRole('button', { name: /close/i }).last().click()
    assert.equal(await pendingCancel.getByRole('button', { name: /send to kitchen/i }).isDisabled(), true)
    await pendingCancel.locator('.waiter-order-cancel-action').click()
    await page.locator('.order-cancel-confirm').click()
    await page.getByText(/order #205 was cancelled/i).waitFor()
    await page.setViewportSize({ width: 320, height: 700 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

async function runCustomer() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  let status301 = 2001
  let pendingBlock = false
  let scopedPostFinished = false
  const attempts = []
  let pendingPosts = 0
  let billGets = 0
  page.on('pageerror', (error) => errors.push(error.message))
  const session = { id: 21, restaurantId: 1, restaurantName: 'Test Restaurant', tableId: 1, tableName: 'Masa-1', reservationId: null, statusId: 7001, openedAt: now, closedAt: null, timeZone: 'Asia/Baku' }
  const otherSession = { ...session, id: 22, tableId: 2, tableName: 'Masa-2' }
  const customerOrder = (id) => {
    const record = order(id, id === 301 ? status301 : id === 303 || id === 304 ? 2002 : 2003, true)
    return id === 303 && pendingBlock ? { ...record, canCancel: false } : record
  }
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token(5) })
    if (pathname === '/api/v1/profile') return json(route, { userId: '5', name: 'Test', surname: 'User', roleId: 5, isActive: true, profiles: [{ restaurantId: null, roleId: 5, roleName: 'Customer', isActive: true }] })
    if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname === '/api/v1/public/table-sessions/my') return json(route, { items: [session, otherSession], pageIndex: 1, totalPages: 1, totalCount: 2 })
    if (pathname === '/api/v1/public/table-sessions/21') return json(route, session)
    if (pathname === '/api/v1/public/table-sessions/22') return json(route, otherSession)
    if (pathname === '/api/v1/public/table-sessions/22/orders') return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname === '/api/v1/public/table-sessions/21/orders' && request.method() === 'GET') return json(route, { items: [301, 302, 303, 304].map(customerOrder), pageIndex: 1, totalPages: 1, totalCount: 4 })
    if (/^\/api\/v1\/public\/table-sessions\/21\/orders\/\d+$/.test(pathname)) return json(route, customerOrder(Number(pathname.split('/').at(-1))))
    if (pathname.endsWith('/orders/301/cancel') && request.method() === 'POST') {
      attempts.push(JSON.parse(request.postData()))
      assert.equal(request.headers()['idempotency-key'], undefined)
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (attempts.length === 1) return route.abort('failed')
      status301 = 2007
      return json(route, order(301, 2007, true))
    }
    if (pathname.endsWith('/orders/303/cancel') && request.method() === 'POST') {
      pendingPosts++
      pendingBlock = true
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, code: 'SessionBillPaymentPending', message: 'Payment pending' }) })
    }
    if (pathname.endsWith('/orders/304/cancel') && request.method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 300))
      scopedPostFinished = true
      return json(route, order(304, 2007, true))
    }
    if (pathname === '/api/v1/table-sessions/21/bill' || pathname === '/api/v1/table-sessions/22/bill') { billGets++; return json(route, { tableSessionId: pathname.includes('/22/') ? 22 : 21, restaurantId: 1, currencyCode: 'AZN', totalAmount: 21, depositCreditAmount: 0, paidAmount: 0, remainingAmount: 21, hasUnservedOrders: false, isOpen: true, enabled: true, isTest: true, canPay: false, canClose: false, latestPayment: null }) }
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    return json(route, {})
  })
  try {
    await page.goto(`${origin}/orders?sessionId=21`)
    await page.locator('.customer-order-row').first().waitFor()
    assert.equal(await page.locator('.customer-order-row').filter({ hasText: 'Sifariş #302' }).getByRole('button', { name: 'Sifarişi ləğv et' }).count(), 0)
    const row = page.locator('.customer-order-row').filter({ hasText: 'Sifariş #301' })
    await row.getByRole('button', { name: 'Sifarişi ləğv et' }).click()
    await page.locator('#order-cancel-reason').selectOption('other')
    await page.locator('#order-cancel-other').fill('ab')
    assert.equal(await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).isDisabled(), true)
    await page.locator('#order-cancel-other').fill('Plan dəyişdi')
    await page.screenshot({ path: path.join(dist, 'order-cancel-customer-390.png'), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, 'order-cancel-customer-1440.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    const billsBeforeCancel = billGets
    await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).click()
    await page.getByRole('button', { name: 'Ləğv edilir...' }).evaluate((button) => button.click())
    await page.getByText(/Nəticə bilinmir/).waitFor()
    assert.equal(attempts.length, 1)
    await page.getByRole('button', { name: 'Eyni cəhdi yoxla' }).click()
    await page.getByText('Sifariş #301 ləğv edildi.').waitFor()
    await page.waitForTimeout(100)
    assert.equal(billGets > billsBeforeCancel, true)
    assert.deepEqual(attempts, [{ reason: 'Plan dəyişdi' }, { reason: 'Plan dəyişdi' }])
    assert.equal(await row.getByRole('button', { name: 'Sifarişi ləğv et' }).count(), 0)
    const pending = page.locator('.customer-order-row').filter({ hasText: 'Sifariş #303' })
    await pending.getByRole('button', { name: 'Sifarişi ləğv et' }).click()
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.includes('Sifarişi ləğv et')), true)
    assert.equal(pendingPosts, 0)
    await pending.getByRole('button', { name: 'Sifarişi ləğv et' }).click()
    await page.locator('#order-cancel-reason').selectOption('planChanged')
    await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).click()
    await page.getByText(/Ödəniş gözləmədədir/).waitFor()
    assert.equal(pendingPosts, 1)
    assert.equal(await pending.getByRole('button', { name: 'Sifarişi ləğv et' }).count(), 0)
    await page.setViewportSize({ width: 320, height: 700 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, 'order-cancel-customer-320.png'), fullPage: true })
    await page.getByRole('button', { name: 'Tünd rejimə keç' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, 'order-cancel-customer-dark-390.png'), fullPage: true })
    await page.locator('.language-switcher-trigger').click()
    await page.locator('.language-switcher-option[lang="ru"]').click()
    await page.locator('.customer-order-row').last().locator('.customer-order-row-cancel .ui-button').click()
    await page.locator('#order-cancel-reason').selectOption('planChanged')
    await page.screenshot({ path: path.join(dist, 'order-cancel-customer-ru-390.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 320, height: 700 })
    await page.screenshot({ path: path.join(dist, 'order-cancel-customer-ru-320.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.language-switcher-trigger').click()
    await page.locator('.language-switcher-option[lang="az"]').click()
    await page.locator('.customer-order-row').filter({ hasText: 'Sifariş #304' }).getByRole('button', { name: 'Sifarişi ləğv et' }).click()
    await page.locator('#order-cancel-reason').selectOption('planChanged')
    await page.getByRole('button', { name: 'Ləğvi təsdiqlə' }).click()
    await page.locator('#customer-order-session-select').selectOption('22')
    await page.getByText('Bu sessiyada hələ sifariş yoxdur').waitFor()
    await page.waitForTimeout(350)
    assert.equal(scopedPostFinished, true)
    assert.equal(await page.getByText('Sifariş #304 ləğv edildi.').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

try {
  await runWaiter()
  await runCustomer()
  console.log('Order cancellation smoke passed')
} finally { await browser.close() }
