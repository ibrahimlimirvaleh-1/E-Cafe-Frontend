import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const at = new Date().toISOString()
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const eventId = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const changed = (id, restaurantId = 1, tableSessionId = 11, orderId = 501, occurredAtUtc = at) =>
  ({ eventId: eventId(id), restaurantId, tableSessionId, orderId, occurredAtUtc })

function json(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function token(userId, roleId) {
  return `header.${Buffer.from(JSON.stringify({ userId: String(userId), name: 'Realtime', surname: 'Test', roleId: String(roleId), restaurantId: '1', restaurantRoles: roleId === 4 ? ['1:4', '2:4'] : [`1:${roleId}`] })).toString('base64url')}.signature`
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const errors = []
try {
  async function openSession(roleId, userId) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    const state = { sockets: [], connected: 0, pendingHandshake: null, listGets: 0, orderGets: 0, billGets: 0, focusGets: 0, focusedStatus: 2001, paymentPosts: 0, checkoutKeys: [], billTotal: 0, billPending: false, billCanPay: false, inFlight: 0, maxInFlight: 0, delayNext: false, ready: false, kitchenStatus: 2001, blockHandshake: false, notificationGets: 0, notificationInFlight: 0, maxNotificationInFlight: 0, failNotificationsOnce: false, notificationAuthError: false, delayNotification403: false, releaseNotification: null }
    const authToken = token(userId, roleId)
    await page.routeWebSocket(/\/hubs\/user-events(?:\?|$)/, (socket) => {
      state.sockets.push(socket)
      socket.onMessage((message) => {
        if (String(message).includes('"protocol"')) {
          if (state.blockHandshake) { state.pendingHandshake = socket; return }
          socket.send('{}\x1e')
          state.connected += 1
        }
      })
    })
    await page.route(`${origin}/**`, async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const pathname = url.pathname
      if (pathname === '/hubs/user-events/negotiate') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connectionId: eventId(state.sockets.length + 100), connectionToken: eventId(state.sockets.length + 100), negotiateVersion: 1, availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text'] }] }) })
      if (pathname.startsWith('/api/v1/')) {
        if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: authToken })
        if (pathname === '/api/v1/profile') return json(route, { userId: String(userId), name: 'Realtime', surname: 'Test', roleId, restaurantId: 1, isActive: true, profiles: [{ restaurantId: 1, restaurantName: 'Test Restaurant', roleId, roleName: roleId === 4 ? 'Waiter' : 'Kitchen', isActive: true }, ...(roleId === 4 ? [{ restaurantId: 2, restaurantName: 'Other Restaurant', roleId, roleName: 'Waiter', isActive: true }] : [])] })
        if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
        if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) return json(route, { language: pathname.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
        if (pathname === '/api/v1/restaurants/1/table-sessions/mine') {
          state.listGets += 1
          return json(route, { items: [{ id: 11, restaurantId: 1, tableId: 1, tableNo: 1, tableName: 'Masa-1', tableCapacity: 2, statusId: 1001, reservationId: 31, customerName: 'Customer', peopleCount: 2, openedAt: at, mustVacateAt: null, requiresCloseReview: false, closeReviewDueAt: null, closeReviewConfirmedAt: null, timeZone: 'Asia/Baku', readyOrderCount: state.ready ? 1 : 0, unsentOrderCount: 0 }], pageIndex: 1, totalPages: 1, totalCount: 1 })
        }
        if (pathname === '/api/v1/restaurants/1/table-sessions/mine/11') return json(route, { id: 11, restaurantId: 1, tableId: 1, tableNo: 1, tableName: 'Masa-1', tableCapacity: 2, statusId: 1001, reservationId: 31, customerName: 'Customer', peopleCount: 2, openedAt: at, mustVacateAt: null, requiresCloseReview: false, closeReviewDueAt: null, closeReviewConfirmedAt: null, timeZone: 'Asia/Baku' })
        if (pathname === '/api/v1/restaurants/1/table-sessions/mine/ready-orders') return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
        if (pathname === '/api/v1/restaurants/2/table-sessions/mine' || pathname === '/api/v1/restaurants/2/table-sessions/mine/ready-orders') return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
        if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders') { state.orderGets += 1; return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 }) }
        if (pathname === '/api/v1/public/restaurants/1/menu') return json(route, [])
        if (pathname === '/api/v1/table-sessions/11/bill') { state.billGets += 1; return json(route, { tableSessionId: 11, restaurantId: 1, reservationId: 31, currencyCode: 'AZN', totalAmount: state.billTotal, depositCreditAmount: 0, paidAmount: 0, remainingAmount: state.billTotal, hasUnservedOrders: false, isOpen: true, enabled: true, isTest: true, canPay: state.billCanPay, canClose: false, latestPayment: state.billPending ? { id: 91, tableSessionId: 11, amount: 7, currencyCode: 'AZN', statusId: 3001, status: 'Pending', isTest: true, requiresRefund: false } : null }) }
        if (pathname === '/api/v1/restaurants/1/kitchen/orders/999/cancellation-request') { state.focusGets += 1; return json(route, { id: 999, restaurantId: 1, tableId: 9, tableName: 'Masa-9', timeZone: 'Asia/Baku', statusId: state.focusedStatus, sentToKitchenAt: at, acceptedAt: state.focusedStatus >= 2002 ? at : null, preparingAt: null, readyAt: null, canAccept: state.focusedStatus === 2001, canStartPreparing: state.focusedStatus === 2002, canMarkReady: false, items: [{ id: 9, itemId: 9, name: 'Coffee', quantity: 1 }] }) }
        if (request.method() === 'POST' && (pathname.includes('/checkout') || pathname.includes('/complete-service') || pathname.includes('/payments/'))) { state.paymentPosts += 1; if (pathname.includes('/checkout')) state.checkoutKeys.push(request.headers()['idempotency-key']); return json(route, {}) }
        if (pathname === '/api/v1/restaurants/1/kitchen/orders') {
          state.listGets += 1
          state.inFlight += 1
          state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
          if (state.delayNext) { state.delayNext = false; await wait(350) }
          const statusId = state.kitchenStatus
          state.inFlight -= 1
          return json(route, { items: [{ id: 501, restaurantId: 1, tableId: 1, tableName: 'Masa-1', timeZone: 'Asia/Baku', statusId, sentToKitchenAt: at, acceptedAt: statusId >= 2002 ? at : null, preparingAt: null, readyAt: null, canAccept: statusId === 2001, canStartPreparing: statusId === 2002, canMarkReady: false, items: [{ id: 1, itemId: 1, name: 'Tea', quantity: 1 }] }], pageIndex: 1, totalPages: 1, totalCount: 1 })
        }
        if (pathname.endsWith('/notifications')) {
          state.notificationGets += 1
          state.notificationInFlight += 1
          state.maxNotificationInFlight = Math.max(state.maxNotificationInFlight, state.notificationInFlight)
          if (state.delayNotification403) {
            state.delayNotification403 = false
            await new Promise((resolve) => { state.releaseNotification = resolve })
            state.notificationInFlight -= 1
            return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Old profile forbidden' }) })
          }
          await wait(80)
          state.notificationInFlight -= 1
          if (state.notificationAuthError) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) })
          if (state.failNotificationsOnce) { state.failNotificationsOnce = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) }) }
          return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
        }
        if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
        return json(route, {})
      }
      const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
      if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
    })
    await page.goto(`${origin}/${roleId === 4 ? 'waiter?view=tables' : 'kitchen'}`)
    await page.waitForFunction(() => document.querySelector('.waiter-session-row, .kitchen-queue-row') !== null)
    if (roleId === 4) {
      await wait(300)
      if (await page.locator('.profile-selection-modal').count()) await page.locator('.profile-selection-list button').first().click()
    }
    await page.waitForFunction(() => !document.querySelector('.realtime-indicator'))
    return { context, page, state }
  }

  const waiter = await openSession(4, 42)
  const kitchen = await openSession(6, 43)
  const send = (session, payload) => session.state.sockets.at(-1).send(`${JSON.stringify({ type: 1, target: 'OrderChanged', arguments: [payload] })}\x1e`)
  await waiter.page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await waiter.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await waiter.page.screenshot({ path: path.join(dist, 'order-realtime-waiter-mobile.png'), fullPage: true })
  await waiter.page.setViewportSize({ width: 320, height: 700 })
  assert.equal(await waiter.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await kitchen.page.setViewportSize({ width: 1440, height: 900 })
  assert.equal(await kitchen.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await kitchen.page.screenshot({ path: path.join(dist, 'order-realtime-kitchen-desktop.png'), fullPage: true })

  const waiterBefore = waiter.state.listGets
  const kitchenBefore = kitchen.state.listGets
  waiter.state.ready = true
  kitchen.state.kitchenStatus = 2002
  send(waiter, changed(1))
  send(kitchen, changed(1))
  await waiter.page.waitForFunction(() => document.querySelector('.waiter-session-row')?.textContent?.includes('Hazır: 1'))
  await kitchen.page.waitForFunction(() => document.querySelector('.kitchen-queue-row')?.textContent?.includes('Qəbul edilib'))
  assert.ok(waiter.state.listGets > waiterBefore)
  assert.ok(kitchen.state.listGets > kitchenBefore)

  const wrongWaiter = waiter.state.listGets
  const wrongKitchen = kitchen.state.listGets
  send(waiter, changed(2, 2))
  send(kitchen, changed(2, 2))
  await wait(400)
  assert.equal(waiter.state.listGets, wrongWaiter)
  assert.equal(kitchen.state.listGets, wrongKitchen)

  kitchen.state.delayNext = true
  send(kitchen, changed(3))
  await kitchen.page.waitForFunction(() => document.querySelector('.kitchen-queue-row') !== null)
  await wait(220)
  const beforeDirty = kitchen.state.listGets
  kitchen.state.kitchenStatus = 2003
  send(kitchen, changed(4, 1, 11, null))
  send(kitchen, changed(4, 1, 11, null))
  send(kitchen, changed(5, 1, 11, 501, new Date(Date.now() - 60_000).toISOString()))
  await kitchen.page.waitForFunction(() => document.querySelector('.kitchen-queue-row')?.textContent?.includes('Hazır') || document.querySelector('.kitchen-queue-row')?.textContent?.includes('Hazırlanır'))
  await wait(700)
  assert.ok(kitchen.state.listGets >= beforeDirty + 1)
  assert.equal(kitchen.state.maxInFlight, 1)

  const beforeNotificationRetry = kitchen.state.notificationGets
  kitchen.state.failNotificationsOnce = true
  kitchen.state.sockets.at(-1).send(`${JSON.stringify({ type: 1, target: 'NotificationsChanged', arguments: [] })}\x1e`)
  await kitchen.page.waitForFunction((count) => document.querySelector('.notification-trigger') !== null, beforeNotificationRetry)
  await wait(3800)
  assert.ok(kitchen.state.notificationGets >= beforeNotificationRetry + 2)
  assert.equal(kitchen.state.maxNotificationInFlight, 1)

  waiter.state.delayNotification403 = true
  waiter.state.sockets.at(-1).send(`${JSON.stringify({ type: 1, target: 'NotificationsChanged', arguments: [] })}\x1e`)
  for (let attempt = 0; !waiter.state.releaseNotification && attempt < 30; attempt += 1) await wait(100)
  assert.ok(waiter.state.releaseNotification)
  await waiter.page.locator('.waiter-sessions-restaurant select').selectOption('2')
  await waiter.page.waitForFunction(() => document.querySelector('.waiter-sessions-restaurant select')?.value === '2')
  await wait(350)
  waiter.state.releaseNotification()
  waiter.state.releaseNotification = null
  await wait(150)
  const beforeProfileRefresh = waiter.state.notificationGets
  waiter.state.sockets.at(-1).send(`${JSON.stringify({ type: 1, target: 'NotificationsChanged', arguments: [] })}\x1e`)
  for (let attempt = 0; waiter.state.notificationGets === beforeProfileRefresh && attempt < 30; attempt += 1) await wait(100)
  assert.ok(waiter.state.notificationGets > beforeProfileRefresh)
  await waiter.page.locator('.waiter-sessions-restaurant select').selectOption('1')
  await waiter.page.locator('.waiter-session-row').first().waitFor()
  await wait(350)
  waiter.state.notificationAuthError = true
  const beforeForbidden = waiter.state.notificationGets
  waiter.state.sockets.at(-1).send(`${JSON.stringify({ type: 1, target: 'NotificationsChanged', arguments: [] })}\x1e`)
  for (let attempt = 0; waiter.state.notificationGets === beforeForbidden && attempt < 30; attempt += 1) await wait(100)
  assert.ok(waiter.state.notificationGets > beforeForbidden)
  const afterForbidden = waiter.state.notificationGets
  await wait(3600)
  assert.equal(waiter.state.notificationGets, afterForbidden)
  waiter.state.notificationAuthError = false

  const oldConnected = waiter.state.connected
  waiter.state.blockHandshake = true
  await waiter.state.sockets.at(-1).close({ code: 1012, reason: 'restart' })
  await waiter.page.waitForFunction(() => document.querySelector('.realtime-indicator') !== null)
  await waiter.page.screenshot({ path: path.join(dist, 'order-realtime-reconnecting-320.png'), fullPage: true })
  await waiter.page.locator('.notification-trigger').click()
  await waiter.page.getByText('Canlı bağlantı bərpa olunur.', { exact: false }).waitFor()
  await waiter.page.screenshot({ path: path.join(dist, 'order-realtime-reconnecting-popover-320.png'), fullPage: true })
  await waiter.page.locator('.notification-trigger').click()
  for (let attempt = 0; !waiter.state.pendingHandshake && attempt < 30; attempt += 1) await wait(100)
  assert.ok(waiter.state.pendingHandshake)
  waiter.state.blockHandshake = false
  waiter.state.pendingHandshake.send('{}\x1e')
  waiter.state.pendingHandshake = null
  waiter.state.connected += 1
  await waiter.page.waitForFunction(() => document.querySelector('.realtime-indicator') === null)
  assert.ok(waiter.state.connected > oldConnected)
  const afterReconnect = waiter.state.listGets
  send(waiter, changed(6))
  await waiter.page.waitForFunction((count) => document.querySelector('.waiter-session-row') !== null, afterReconnect)
  await wait(400)
  assert.ok(waiter.state.listGets > afterReconnect)

  await waiter.page.goto(`${origin}/waiter/restaurants/1/sessions/11/orders`)
  await waiter.page.getByRole('group', { name: 'Masa bölmələri' }).waitFor()
  await wait(700)
  const oldOrderGets = waiter.state.orderGets
  const oldBillGets = waiter.state.billGets
  send(waiter, changed(7, 1, 12))
  await wait(400)
  assert.equal(waiter.state.orderGets, oldOrderGets)
  send(waiter, changed(8, 1, 11, null))
  for (let attempt = 0; (waiter.state.orderGets === oldOrderGets || waiter.state.billGets === oldBillGets) && attempt < 30; attempt += 1) await wait(100)
  assert.ok(waiter.state.orderGets > oldOrderGets)
  assert.ok(waiter.state.billGets > oldBillGets)
  waiter.state.billTotal = 7
  waiter.state.billPending = true
  const pendingBillGets = waiter.state.billGets
  send(waiter, changed(9, 1, 11, 501))
  for (let attempt = 0; waiter.state.billGets === pendingBillGets && attempt < 30; attempt += 1) await wait(100)
  await waiter.page.getByRole('button', { name: 'Hesab' }).click()
  await waiter.page.getByText('7.00 AZN').first().waitFor()
  assert.equal(await waiter.page.getByRole('button', { name: 'Xidməti bitir' }).isDisabled(), true)
  assert.equal(waiter.state.paymentPosts, 0)
  waiter.state.billPending = false
  waiter.state.billCanPay = true
  await waiter.page.evaluate(() => sessionStorage.setItem('ecafe:session-bill-checkout:42:11', JSON.stringify({ key: 'legacy-checkout-key', previousPaymentId: null })))
  send(waiter, changed(10, 1, 11, 501))
  await waiter.page.getByRole('button', { name: 'Test ödənişi yarat' }).waitFor({ state: 'visible' })
  await waiter.page.getByRole('button', { name: 'Test ödənişi yarat' }).click()
  for (let attempt = 0; waiter.state.checkoutKeys.length === 0 && attempt < 30; attempt += 1) await wait(100)
  assert.deepEqual(waiter.state.checkoutKeys, ['legacy-checkout-key'])

  await kitchen.page.goto(`${origin}/kitchen?orderId=999`)
  await kitchen.page.locator('.kitchen-queue-focused').waitFor()
  await wait(450)
  const oldFocusGets = kitchen.state.focusGets
  kitchen.state.focusedStatus = 2002
  send(kitchen, changed(11, 1, 99, 999))
  for (let attempt = 0; kitchen.state.focusGets === oldFocusGets && attempt < 30; attempt += 1) await wait(100)
  assert.ok(kitchen.state.focusGets > oldFocusGets)
  await kitchen.page.locator('.kitchen-queue-focused').getByText('Qəbul edilib').waitFor()

  assert.deepEqual(errors, [])
  await waiter.context.close()
  await kitchen.context.close()
  console.log('Order realtime SignalR smoke passed')
} finally {
  await browser.close()
}
