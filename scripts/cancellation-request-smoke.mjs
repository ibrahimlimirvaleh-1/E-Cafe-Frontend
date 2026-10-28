import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const now = '2026-10-25T10:00:00Z'

function token(roleId) {
  return `header.${Buffer.from(JSON.stringify({ userId: String(roleId), name: 'QA', surname: 'User', roleId: String(roleId), restaurantId: roleId === 5 ? null : '1', restaurantRoles: roleId === 5 ? [] : [`1:${roleId}`] })).toString('base64url')}.signature`
}

function response(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function requestRecord(id, statusId, reason = 'Plan dəyişdi', decisionReason = null, ingredientsUnused = null, stockReturnedAt = null, stockReturnMode = ingredientsUnused === true ? 2 : ingredientsUnused === false ? 1 : null) {
  return { id, statusId, reason, requestedAt: now, forwardedAt: statusId >= 2 ? now : null, resolvedAt: statusId >= 3 ? now : null, decisionReason, ingredientsUnused, stockReturnMode, stockReturnedAt }
}

function order(id, roleId, cancellationRequest = null) {
  const kitchen = roleId === 6
  const base = {
    id, restaurantId: 1, tableId: 1, tableSessionId: roleId === 5 ? 21 : 11,
    statusId: cancellationRequest?.statusId === 3 ? 2007 : 2003,
    openedAt: now, sentToKitchenAt: now, acceptedAt: now, preparingAt: now,
    readyAt: null, servedAt: null, closedAt: null, cancelledAt: cancellationRequest?.statusId === 3 ? now : null,
    cancellationReason: cancellationRequest?.statusId === 3 ? cancellationRequest.reason : null,
    canCancel: false, canMarkServed: false, canMarkReady: kitchen && cancellationRequest?.statusId !== 2,
    canAccept: false, canStartPreparing: false,
    canRequestCancellation: roleId !== 6 && !cancellationRequest,
    canForwardCancellationRequest: roleId === 4 && cancellationRequest?.statusId === 1,
    canDecideCancellationRequest: kitchen && cancellationRequest?.statusId === 2,
    cancellationRequest, subtotal: 7, note: null, tableName: 'Masa-1', timeZone: 'Asia/Baku',
    items: [{ id, itemId: 5, name: 'Tea', quantity: 1, unitPrice: 7, lineTotal: 7, note: null }],
  }
  return base
}

function asset(route, pathname) {
  const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
  if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
}

async function contextFor(browser, roleId, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page, errors, roleId }
}

async function assertDecisionDialogLayout(page, name) {
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector('.cancellation-request-dialog')
    const header = dialog.querySelector('.reservation-action-dialog-header')
    const body = dialog.querySelector('.reservation-action-dialog-body')
    const footer = dialog.querySelector('.reservation-action-dialog-actions')
    const products = dialog.querySelector('.cancellation-request-products')
    const radios = [...dialog.querySelectorAll('.cancellation-request-ingredients-options label')]
    const textarea = dialog.querySelector('#cancellation-request-reason')
    const rect = (element) => element.getBoundingClientRect()
    return {
      dialog: rect(dialog), header: rect(header), body: rect(body), footer: rect(footer),
      products: rect(products), radios: radios.map(rect), textarea: rect(textarea),
      pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight,
    }
  })
  assert.ok(layout.products.height >= 32, `${name}: product list collapsed`)
  assert.ok(layout.radios.every((radio) => radio.height >= 44), `${name}: ingredient choice collapsed`)
  assert.ok(layout.textarea.height >= 80, `${name}: reason field collapsed`)
  assert.equal(layout.radios.length, 3, `${name}: expected three ingredient choices`)
  assert.ok(layout.textarea.bottom <= layout.radios[0].top, `${name}: decision reason should precede stock choices`)
  assert.ok(layout.radios.slice(1).every((radio, index) => layout.radios[index].right <= radio.left || layout.radios[index].bottom <= radio.top), `${name}: ingredient choices overlap`)
  assert.ok(layout.header.bottom <= layout.body.top + 2, `${name}: header overlaps body`)
  assert.ok(layout.body.bottom <= layout.footer.top + 2, `${name}: footer overlaps body`)
  assert.ok(layout.textarea.top >= layout.body.top - 1 && layout.textarea.bottom <= layout.body.bottom + 1, `${name}: decision reason is hidden before scrolling`)
  assert.ok(layout.dialog.bottom <= layout.viewportHeight + 1, `${name}: dialog extends past viewport`)
  assert.ok(layout.pageWidth <= layout.viewportWidth, `${name}: horizontal overflow`)
  await page.locator('.reservation-action-dialog-body').evaluate((body) => { body.scrollTop = body.scrollHeight })
  const scrolled = await page.evaluate(() => {
    const body = document.querySelector('.cancellation-request-dialog .reservation-action-dialog-body').getBoundingClientRect()
    const info = document.querySelector('.cancellation-request-dialog .cancellation-request-info').getBoundingClientRect()
    return { body, info }
  })
  assert.ok(scrolled.info.top >= scrolled.body.top - 1 && scrolled.info.bottom <= scrolled.body.bottom + 1, `${name}: request info is hidden after scrolling`)
  await page.screenshot({ path: path.join(dist, `cancellation-request-kitchen-unused-${name}-scrolled.png`) })
  await page.locator('.reservation-action-dialog-body').evaluate((body) => { body.scrollTop = 0 })
}

function commonRoute(roleId, route, pathname) {
  if (pathname === '/api/v1/user/refresh') return response(route, { accessToken: token(roleId) })
  if (pathname === '/api/v1/profile') return response(route, { userId: String(roleId), name: 'QA', surname: 'User', roleId, restaurantId: roleId === 5 ? null : 1, isActive: true, profiles: [{ restaurantId: roleId === 5 ? null : 1, restaurantName: 'Test Restaurant', roleId, roleName: roleId === 5 ? 'Customer' : roleId === 4 ? 'Waiter' : 'Kitchen', isActive: true }] })
  if (pathname === '/api/v1/localization/preference') return response(route, { language: 'az' })
  if (pathname.startsWith('/api/v1/localization/dictionaries/')) return response(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
  if (pathname.endsWith('/notifications')) {
    const orderId = roleId === 5 ? 301 : roleId === 4 ? 401 : 501
    return response(route, [{ id: `notification-${roleId}`, restaurantId: 1, title: 'Ləğv sorğusu', message: 'Sifariş yeniləndi', typeId: 1, typeName: 'OrderCancellationRequest', channelId: 1, statusId: 1, isRead: true, payloadJson: JSON.stringify({ section: 'order-cancellation-request', restaurantId: 1, tableSessionId: roleId === 5 ? 21 : 11, orderId }), relatedEntityType: 'Order', relatedEntityId: orderId, createdAt: now }])
  }
  if (pathname.endsWith('/unread-count')) return response(route, { count: 0 })
  return null
}

async function customer(browser) {
  const { context, page, errors } = await contextFor(browser, 5, { width: 390, height: 844 })
  let record = order(301, 5)
  let posts = 0
  await page.route(`${origin}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (commonRoute(5, route, pathname)) return
    if (pathname === '/api/v1/public/table-sessions/my') return response(route, { items: [{ id: 21, restaurantId: 1, restaurantName: 'Test Restaurant', tableId: 1, tableName: 'Masa-1', statusId: 7001, openedAt: now, timeZone: 'Asia/Baku' }], pageIndex: 1, totalPages: 1, totalCount: 1 })
    if (pathname === '/api/v1/public/table-sessions/21') return response(route, { id: 21, restaurantId: 1, restaurantName: 'Test Restaurant', tableId: 1, tableName: 'Masa-1', statusId: 7001, openedAt: now, timeZone: 'Asia/Baku' })
    if (pathname === '/api/v1/public/table-sessions/21/orders') return response(route, { items: [record, { ...order(302, 5), statusId: 2004, readyAt: now, canRequestCancellation: false }], pageIndex: 1, totalPages: 1, totalCount: 2 })
    if (pathname === '/api/v1/public/table-sessions/21/orders/301') return response(route, record)
    if (pathname === '/api/v1/public/table-sessions/21/orders/301/cancellation-request') {
      posts++
      assert.deepEqual(JSON.parse(route.request().postData()), { reason: 'Plan dəyişdi' })
      assert.equal(route.request().headers()['idempotency-key'], undefined)
      record = order(301, 5, requestRecord(1, 1))
      return response(route, record)
    }
    if (pathname === '/api/v1/table-sessions/21/bill') return response(route, { tableSessionId: 21, restaurantId: 1, currencyCode: 'AZN', totalAmount: 7, depositCreditAmount: 0, paidAmount: 0, remainingAmount: 7, hasUnservedOrders: true, isOpen: true, enabled: true, isTest: true, canPay: false, canClose: false, latestPayment: null })
    return response(route, {})
  })
  try {
    await page.goto(`${origin}/orders?sessionId=21`)
    const row = page.locator('.customer-order-row').filter({ hasText: 'Sifariş #301' })
    assert.equal(await page.locator('.customer-order-row').filter({ hasText: 'Sifariş #302' }).getByRole('button', { name: 'Ləğv sorğusu' }).count(), 0)
    await row.getByRole('button', { name: 'Ləğv sorğusu' }).click()
    await page.locator('#cancellation-request-choice').selectOption('planChanged')
    await page.screenshot({ path: path.join(dist, 'cancellation-request-customer-390.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-customer-1440.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-customer-dark-390.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
    await page.getByRole('dialog').getByRole('button', { name: 'Sorğunu göndər' }).click()
    await row.getByText('Ofisiantın yönləndirməsi gözlənilir').waitFor()
    assert.equal(posts, 1)
    assert.equal(await row.getByRole('button', { name: 'Ləğv sorğusu' }).count(), 0)
    await page.locator('.notification-trigger').click()
    await page.locator('.notification-list button').first().click()
    await page.waitForURL('**/orders?sessionId=21&orderId=301')
    await page.setViewportSize({ width: 320, height: 700 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

async function waiter(browser) {
  const { context, page, errors } = await contextFor(browser, 4, { width: 390, height: 844 })
  let forwarded = order(401, 4, requestRecord(2, 1))
  let created = order(402, 4)
  let forwards = 0
  await page.route(`${origin}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (commonRoute(4, route, pathname)) return
    if (pathname === '/api/v1/restaurants/1/table-sessions/mine/11') return response(route, { id: 11, restaurantId: 1, tableId: 1, tableNo: 1, tableName: 'Masa-1', tableCapacity: 4, statusId: 1001, customerName: 'Customer', peopleCount: 2, openedAt: now, timeZone: 'Asia/Baku' })
    if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders') return response(route, { items: [forwarded, created], pageIndex: 1, totalPages: 1, totalCount: 2 })
    if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders/401') return response(route, forwarded)
    if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders/402') return response(route, created)
    if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders/401/cancellation-request/forward') {
      forwards++
      assert.equal(route.request().postData(), null)
      forwarded = order(401, 4, requestRecord(2, 2))
      return response(route, forwarded)
    }
    if (pathname === '/api/v1/restaurants/1/table-sessions/11/orders/402/cancellation-request') {
      assert.deepEqual(JSON.parse(route.request().postData()), { reason: 'Plan dəyişdi' })
      created = order(402, 4, requestRecord(3, 2))
      return response(route, created)
    }
    if (pathname === '/api/v1/public/restaurants/1/menu') return response(route, [])
    if (pathname === '/api/v1/table-sessions/11/bill') return response(route, { tableSessionId: 11, restaurantId: 1, currencyCode: 'AZN', totalAmount: 14, depositCreditAmount: 0, paidAmount: 0, remainingAmount: 14, hasUnservedOrders: true, isOpen: true, enabled: true, isTest: true, canPay: false, canClose: false, latestPayment: null })
    return response(route, {})
  })
  try {
    await page.goto(`${origin}/waiter/restaurants/1/sessions/11/orders`)
    const first = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #401' })
    await first.getByRole('button', { name: 'Mətbəxə ötür' }).click()
    await page.getByRole('dialog').getByText('Plan dəyişdi').waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Mətbəxə ötür' }).click()
    await first.getByText('Mətbəxin qərarı gözlənilir').waitFor()
    assert.equal(forwards, 1)
    const second = page.locator('.waiter-order-row').filter({ hasText: 'Sifariş #402' })
    await second.getByRole('button', { name: 'Ləğv sorğusu' }).click()
    await page.locator('#cancellation-request-choice').selectOption('planChanged')
    await page.getByRole('dialog').getByRole('button', { name: 'Sorğunu göndər' }).click()
    await second.getByText('Mətbəxin qərarı gözlənilir').waitFor()
    await page.locator('.notification-trigger').click()
    await page.locator('.notification-list button').first().click()
    await page.waitForURL('**/waiter/restaurants/1/sessions/11/orders?orderId=401')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

async function kitchen(browser) {
  const { context, page, errors } = await contextFor(browser, 6, { width: 390, height: 844 })
  let first = order(501, 6, requestRecord(4, 2))
  let second = order(502, 6, requestRecord(5, 2))
  let third = order(503, 6, requestRecord(6, 2))
  let fourth = order(504, 6, requestRecord(7, 2))
  let fifth = order(505, 6, requestRecord(8, 2))
  let sixth = order(506, 6, requestRecord(9, 2))
  let seventh = order(507, 6, requestRecord(10, 2))
  let eighth = order(508, 6, requestRecord(11, 2))
  let ninth = order(509, 6, requestRecord(12, 2))
  let thirdAttempts = 0
  let sixthAttempts = 0
  let seventhAttempts = 0
  let eighthAttempts = 0
  let ninthAttempts = 0
  const decisions = []
  await page.route(`${origin}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (commonRoute(6, route, pathname)) return
    if (pathname === '/api/v1/restaurants/1/kitchen/orders') return response(route, { items: [first, second, third, fourth, fifth, sixth, seventh, eighth, ninth], pageIndex: 1, totalPages: 1, totalCount: 9 })
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/501/cancellation-request') return response(route, first)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/502/cancellation-request') return response(route, second)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/503/cancellation-request') return response(route, third)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/504/cancellation-request') return response(route, fourth)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/505/cancellation-request') return response(route, fifth)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/506/cancellation-request') return response(route, sixth)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/507/cancellation-request') return response(route, seventh)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/508/cancellation-request') return response(route, eighth)
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/509/cancellation-request') return response(route, ninth)
    if (/^\/api\/v1\/restaurants\/1\/kitchen\/orders\/\d+\/cancellation-request\/stock-return$/.test(pathname)) {
      const orderId = Number(pathname.split('/')[7])
      return response(route, { orderId, ingredients: [
        { inventoryItemId: 12, name: 'Un', unitId: 2, unitName: 'Qram', unitCode: 'g', consumedQuantity: 90, ...(orderId === 509 ? { consumedQuantityText: '999999999999.123456' } : {}) },
        { inventoryItemId: 13, name: 'Yumurta', unitId: 3, unitName: 'Ədəd', unitCode: 'pcs', consumedQuantity: 2 },
      ] })
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/501/cancellation-request/decision') {
      decisions.push(JSON.parse(route.request().postData()))
      first = order(501, 6, requestRecord(4, 4, 'Plan dəyişdi', 'Hazırlıq artıq gedir'))
      return response(route, first)
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/502/cancellation-request/decision') {
      decisions.push(JSON.parse(route.request().postData()))
      second = order(502, 6, requestRecord(5, 3, 'Plan dəyişdi', 'Hazırlıq dayandırıldı', true, now))
      return route.abort('failed')
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/503/cancellation-request/decision') {
      thirdAttempts++
      const payload = JSON.parse(route.request().postData())
      assert.deepEqual(payload, { approved: false, reason: 'Hazırlıq davam etməlidir' })
      if (thirdAttempts === 1) return route.abort('failed')
      third = order(503, 6, requestRecord(6, 4, 'Plan dəyişdi', payload.reason))
      return response(route, third)
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/504/cancellation-request/decision') {
      assert.deepEqual(JSON.parse(route.request().postData()), { approved: true, reason: 'Hazırlıq dayandırıldı', stockReturnMode: 2 })
      fourth = order(504, 6, requestRecord(7, 3, 'Plan dəyişdi', 'Başqa aşpaz qəbul etdi', false))
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, code: 'OrderCancellationRequestConflict', message: 'Decision already made' }) })
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/505/cancellation-request/decision') {
      assert.deepEqual(JSON.parse(route.request().postData()), { approved: true, reason: 'Ərzaq istifadə olunub', stockReturnMode: 1 })
      fifth = order(505, 6, requestRecord(8, 3, 'Plan dəyişdi', 'Ərzaq istifadə olunub', false))
      return response(route, fifth)
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/506/cancellation-request/decision') {
      sixthAttempts++
      assert.deepEqual(JSON.parse(route.request().postData()), { approved: true, reason: 'Hazırlıq dayandırıldı', stockReturnMode: 2 })
      if (sixthAttempts === 1) return route.abort('failed')
      sixth = order(506, 6, requestRecord(9, 3, 'Plan dəyişdi', 'Hazırlıq dayandırıldı', true, now))
      return response(route, sixth)
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/507/cancellation-request/decision') {
      seventhAttempts++
      assert.deepEqual(JSON.parse(route.request().postData()), { approved: true, reason: 'Hazırlıq dayandırıldı', stockReturnMode: 2 })
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, code: 'OrderStockReturnQuantitiesInvalid', message: 'Stok uçotu uyğun deyil. Ləğv təsdiqlənmədi.' }) })
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/508/cancellation-request/decision') {
      eighthAttempts++
      assert.deepEqual(JSON.parse(route.request().postData()), { approved: true, reason: 'Qismən istifadə olunub', stockReturnMode: 3, stockReturns: [{ inventoryItemId: 12, returnQuantity: '60.5' }, { inventoryItemId: 13, returnQuantity: '0' }] })
      if (eighthAttempts === 1) return route.abort('failed')
      eighth = { ...order(508, 6, requestRecord(11, 3, 'Plan dəyişdi', 'Qismən istifadə olunub', null, now, 3)), stockReturns: [{ inventoryItemId: 13, returnQuantity: 0, returnQuantityText: '0' }, { inventoryItemId: 12, returnQuantity: 60.5, returnQuantityText: '60.5' }] }
      return response(route, eighth)
    }
    if (pathname === '/api/v1/restaurants/1/kitchen/orders/509/cancellation-request/decision') {
      ninthAttempts++
      assert.deepEqual(JSON.parse(route.request().postData()), { approved: true, reason: 'Qismən istifadə olunub', stockReturnMode: 3, stockReturns: [{ inventoryItemId: 12, returnQuantity: '0.000001' }, { inventoryItemId: 13, returnQuantity: '0' }] })
      ninth = { ...order(509, 6, requestRecord(12, 3, 'Plan dəyişdi', 'Başqa qərar verildi', null, now, 3)), stockReturns: [{ inventoryItemId: 12, returnQuantity: 0.000002, returnQuantityText: '0.000002' }, { inventoryItemId: 13, returnQuantity: 0, returnQuantityText: '0' }] }
      return route.abort('failed')
    }
    return response(route, {})
  })
  try {
    await page.goto(`${origin}/kitchen`)
    await page.locator('.notification-trigger').click()
    await page.locator('.notification-list button').first().click()
    await page.waitForURL('**/kitchen?restaurantId=1&orderId=501')
    const firstRow = page.locator('.kitchen-queue-row').filter({ hasText: '#501' })
    await firstRow.locator('.cancellation-request-info').waitFor()
    assert.equal(await firstRow.evaluate((row) => row.classList.contains('is-focused')), true)
    await firstRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Qərar seçin' }).isDisabled(), false)
    await page.getByRole('dialog').getByRole('button', { name: 'Qərar seçin' }).click()
    await page.getByRole('dialog').getByRole('alert').getByText('Qərar seçin').waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Sorğunu rədd et' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Hazırlıq artıq gedir')
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-390.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-1440.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('dialog').getByRole('button', { name: 'Sorğunu rədd et' }).last().click()
    await firstRow.getByText('Ləğv sorğusu rədd edildi').waitFor()
    const secondRow = page.locator('.kitchen-queue-row').filter({ hasText: '#502' })
    await secondRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Hazırlıq dayandırıldı')
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().isDisabled(), false)
    await page.getByRole('dialog').getByLabel('İstifadə olunmayıb').check()
    await page.getByText('Stoka qaytarılacaq ərzaq').waitFor()
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-unused-390.png') })
    await assertDecisionDialogLayout(page, '390')
    await page.setViewportSize({ width: 320, height: 700 })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-unused-320.png') })
    await assertDecisionDialogLayout(page, '320')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-unused-dark-390.png') })
    await assertDecisionDialogLayout(page, 'dark-390')
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-unused-1440.png') })
    await assertDecisionDialogLayout(page, '1440')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-unused-dark-1440.png') })
    await assertDecisionDialogLayout(page, 'dark-1440')
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await page.getByText('Sifariş #502 ləğv edildi.').waitFor()
    await secondRow.getByText('Ərzaq stoka qaytarılıb:').waitFor()
    assert.deepEqual(decisions, [{ approved: false, reason: 'Hazırlıq artıq gedir' }, { approved: true, reason: 'Hazırlıq dayandırıldı', stockReturnMode: 2 }])
    const thirdRow = page.locator('.kitchen-queue-row').filter({ hasText: '#503' })
    await thirdRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sorğunu rədd et' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Hazırlıq davam etməlidir')
    await page.getByRole('dialog').getByRole('button', { name: 'Sorğunu rədd et' }).last().click()
    await page.getByText(/Nəticə məlum deyil/).waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Bağla' }).last().click()
    await thirdRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    assert.equal(await page.getByRole('dialog').getByText('Hazırlıq davam etməlidir').count(), 1)
    assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).count(), 0)
    await page.getByRole('dialog').getByRole('button', { name: 'Eyni cəhdi yoxla' }).click()
    await thirdRow.getByText('Ləğv sorğusu rədd edildi').waitFor()
    assert.equal(thirdAttempts, 2)
    const fourthRow = page.locator('.kitchen-queue-row').filter({ hasText: '#504' })
    await fourthRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Hazırlıq dayandırıldı')
    await page.getByRole('dialog').getByLabel('İstifadə olunmayıb').check()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await page.getByText('Sifarişin vəziyyəti dəyişib. Məlumatlar yenilənir.').waitFor()
    await fourthRow.getByText('Ləğv sorğusu qəbul edildi').waitFor()
    assert.equal(await fourthRow.getByText('Ərzaq stoka qaytarılıb:').count(), 0)
    const fifthRow = page.locator('.kitchen-queue-row').filter({ hasText: '#505' })
    await fifthRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Ərzaq istifadə olunub')
    await page.getByRole('dialog').getByLabel('Tam istifadə olunub').check()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await fifthRow.getByText('Ləğv sorğusu qəbul edildi').waitFor()
    assert.equal(await fifthRow.getByText('Ərzaq stoka qaytarılıb:').count(), 0)
    const sixthRow = page.locator('.kitchen-queue-row').filter({ hasText: '#506' })
    await sixthRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Hazırlıq dayandırıldı')
    await page.getByRole('dialog').getByLabel('İstifadə olunmayıb').check()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await page.getByText(/Nəticə məlum deyil/).waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Bağla' }).last().click()
    await sixthRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByText('Təkrar yoxlamada əvvəlki ərzaq qərarı saxlanılır:').waitFor()
    assert.equal(await page.getByRole('dialog').getByLabel('Tam istifadə olunub').count(), 0)
    await page.getByRole('dialog').getByRole('button', { name: 'Eyni cəhdi yoxla' }).click()
    await sixthRow.getByText('Ərzaq stoka qaytarılıb:').waitFor()
    assert.equal(sixthAttempts, 2)
    const seventhRow = page.locator('.kitchen-queue-row').filter({ hasText: '#507' })
    await seventhRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Hazırlıq dayandırıldı')
    await page.getByRole('dialog').getByLabel('İstifadə olunmayıb').check()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await page.getByRole('dialog').getByRole('alert').getByText('Stok uçotu uyğun deyil. Ləğv təsdiqlənmədi.').waitFor()
    assert.equal(await page.getByRole('dialog').getByLabel('İstifadə olunmayıb').isChecked(), true)
    assert.equal(seventhAttempts, 1)
    await seventhRow.getByText('Mətbəxin qərarı gözlənilir').waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Bağla' }).last().click()
    const eighthRow = page.locator('.kitchen-queue-row').filter({ hasText: '#508' })
    await eighthRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Qismən istifadə olunub')
    await page.getByRole('dialog').getByLabel('Ərzaq üzrə seç').check()
    const partialInputs = page.getByRole('dialog').locator('.cancellation-stock-row input')
    await partialInputs.first().fill('60,5')
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await page.getByRole('dialog').getByRole('alert').getByText('0 ilə maksimum miqdar arasında, ən çox 6 onluq rəqəm yazın.').waitFor()
    assert.equal(eighthAttempts, 0)
    await partialInputs.last().fill('0')
    await page.setViewportSize({ width: 320, height: 700 })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-partial-320.png') })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-partial-dark-390.png') })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: path.join(dist, 'cancellation-request-kitchen-partial-1440.png') })
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await page.getByText(/Nəticə məlum deyil/).waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Eyni cəhdi yoxla' }).click()
    await eighthRow.getByText('Ərzaq stoka qaytarılıb:').waitFor()
    assert.equal(eighthAttempts, 2)
    const ninthRow = page.locator('.kitchen-queue-row').filter({ hasText: '#509' })
    await ninthRow.getByRole('button', { name: 'Sorğunu nəzərdən keçir' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).first().click()
    await page.locator('#cancellation-request-reason').fill('Qismən istifadə olunub')
    await page.getByRole('dialog').getByLabel('Ərzaq üzrə seç').check()
    await page.getByRole('dialog').locator('.cancellation-stock-row input').first().fill('0,000001')
    await page.getByRole('dialog').locator('.cancellation-stock-row input').last().fill('0')
    await page.getByRole('dialog').getByText('999999999999.123455 g').waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Ləğvi təsdiqlə' }).last().click()
    await page.getByText('Sifarişin vəziyyəti dəyişib. Məlumatlar yenilənir.').waitFor()
    assert.equal(ninthAttempts, 1)
    await page.setViewportSize({ width: 320, height: 700 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  await customer(browser)
  await waiter(browser)
  await kitchen(browser)
  console.log('Cancellation request customer/waiter/kitchen smoke passed')
} finally { await browser.close() }
