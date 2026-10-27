import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Admin', roleId: '1', roleName: 'Platform Admin' })).toString('base64url')}.signature`
const item = { id: 22, restaurantId: 1, name: 'Espresso', unitId: 2, unitName: 'Piece', unitCode: 'pcs', quantityOnHand: 12.123456, lowStockThreshold: 2, isActive: true }
let historyRequests = 0
let failHistory = false

function json(route, data, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function movement(id, type, quantity, extras = {}) {
  return {
    id, restaurantId: 1, inventoryItemId: 22, quantityChange: quantity,
    unitId: 2, unitName: 'Piece', unitCode: 'pcs', movementTypeId: type,
    movementTypeCode: `type-${type}`, createdAt: '2026-10-25T10:00:00',
    reason: null, ...extras,
  }
}

function asset(route, pathname) {
  const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
  if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
    if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Admin', roleId: 1, isActive: true })
    if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname === '/api/v1/restaurants/getAll') return json(route, [{ id: 1, name: 'QA Restaurant', location: 'Baku', timeZone: 'Asia/Baku', hasActiveContract: true, isActive: true }])
    if (pathname === '/api/v1/restaurants/1/inventory') return json(route, { items: [item], pageIndex: 1, totalPages: 1, totalCount: 1, hasPreviousPage: false, hasNextPage: false })
    if (pathname === '/api/v1/restaurants/1/inventory/22') return json(route, { ...item, quantityOnHand: 13.123456 })
    if (pathname === '/api/v1/restaurants/1/inventory/22/movements') {
      historyRequests++
      if (failHistory) return json(route, { message: 'History unavailable' }, 503)
      const pageNumber = Number(url.searchParams.get('PageNumber') || url.searchParams.get('pageNumber') || 1)
      const all = [
        movement(1, 1, 10, { reason: 'Təchizatçıdan alındı' }),
        movement(2, 4, -0.123456, { relatedOrderId: 'ABC-42', relatedOrderItemId: 99, orderItemName: 'Uzun espresso sifarişi', orderItemQuantity: 2, tableNo: 12, reason: 'Internal processing' }),
        movement(3, 6, 0.123456, { reversedMovementId: 2, relatedOrderId: 'ABC-42', orderItemName: 'Uzun espresso sifarişi', orderItemQuantity: 2, tableNo: 12 }),
        movement(4, 6, 1, { reason: 'Manual return', reversedMovementId: null }),
        ...Array.from({ length: 7 }, (_, index) => movement(index + 5, 2, 1)),
      ]
      return json(route, { items: pageNumber === 1 ? all.slice(0, 10) : all.slice(10), pageIndex: pageNumber, totalPages: 2, totalCount: 11, hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber < 2 })
    }
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    return json(route, {})
  })

  await page.goto(`${origin}/admin/inventory/movements?restaurantId=1`)
  const opener = page.getByRole('button', { name: 'Espresso tarixçəsinə bax' })
  await opener.waitFor()
  assert.equal(historyRequests, 0, 'history must not preload')
  assert.equal(await page.locator('.admin-sidebar nav a.active').count(), 1)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Espresso' })
  await dialog.waitFor()
  await dialog.getByText('Ləğv səbəbilə qaytarıldı').waitFor()
  assert.equal(await dialog.getByText('Stoka qaytarma').count(), 1)
  assert.equal(await dialog.getByText('Hazırlanma üçün sərf edildi').count(), 1)
  assert.match(await dialog.locator('.inventory-history-row time').first().innerText(), /14:00/)
  assert.equal(await dialog.getByText('Cari stok').count(), 1)
  assert.match(await dialog.locator('.inventory-history-balance').innerText(), /13[,.]123456/)
  assert.equal(await dialog.getByText('Son miqdar').count(), 0)
  assert.equal(await dialog.getByText('Internal processing').count(), 0)
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Tarixçəni bağla')
  assert.equal(await page.locator('#root').evaluate((root) => root.inert), true)
  assert.equal(await dialog.evaluate((element) => getComputedStyle(element.closest('.inventory-history-backdrop')).zIndex), '2000')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 740 })
    const layout = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const header = element.querySelector('.inventory-history-header').getBoundingClientRect()
      const body = element.querySelector('.inventory-history-body').getBoundingClientRect()
      const footer = element.querySelector('.inventory-history-footer').getBoundingClientRect()
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, headerBottom: header.bottom, bodyTop: body.top, bodyBottom: body.bottom, footerTop: footer.top, footerBottom: footer.bottom, viewport: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth }
    })
    assert.ok(layout.left >= 0 && layout.right <= layout.viewport + 1, JSON.stringify(layout))
    assert.ok(layout.top >= 0 && layout.bottom <= layout.height + 1, JSON.stringify(layout))
    assert.ok(layout.headerBottom <= layout.bodyTop + 1 && layout.bodyBottom <= layout.footerTop + 1, JSON.stringify(layout))
    assert.ok(layout.pageWidth <= layout.viewport, JSON.stringify(layout))
    await page.screenshot({ path: path.join(dist, `inventory-history-${width}-light.png`) })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.screenshot({ path: path.join(dist, `inventory-history-${width}-dark.png`) })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  }
  await dialog.getByRole('button', { name: /Növbəti səhifə/i }).click()
  await dialog.getByRole('button', { name: '2', exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.inventory-history-list .inventory-history-row').length === 1)
  assert.equal(await dialog.locator('.inventory-history-row').count(), 1)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog', { name: 'Espresso' }).count(), 0)
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Espresso tarixçəsinə bax')
  assert.equal(await page.locator('#root').evaluate((root) => root.inert), false)
  failHistory = true
  await opener.click()
  await dialog.getByRole('button', { name: 'Yenidən yoxla' }).waitFor()
  failHistory = false
  await dialog.getByRole('button', { name: 'Yenidən yoxla' }).click()
  await dialog.getByText('Ləğv səbəbilə qaytarıldı').waitFor()
  await dialog.getByRole('button', { name: 'Tarixçəni bağla' }).click()
  await page.getByRole('button', { name: /Dil: Azərbaycanca/ }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'View Espresso history' }).click()
  await dialog.getByText('Returned after cancellation').waitFor()
  assert.match(await dialog.locator('.inventory-history-balance').innerText(), /13[,.]123456 pcs/)
  await dialog.getByRole('button', { name: 'Close history' }).click()
  await page.getByRole('button', { name: /Language: English/ }).click()
  await page.getByRole('button', { name: 'Русский' }).click()
  await page.getByRole('button', { name: 'История движения Espresso' }).click()
  await dialog.getByText('Возвращено после отмены').waitFor()
  assert.match(await dialog.locator('.inventory-history-balance').innerText(), /13[,.]123456 шт\./)
  assert.deepEqual(pageErrors, [])
  console.log('PASS inventory history: lazy load, current stock, semantics, 3 viewports x 2 themes, pagination, focus, error retry')
} finally {
  await browser.close()
}
