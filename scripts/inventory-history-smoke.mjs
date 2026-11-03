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
let hasUnknownStockCost = true
let currentQuantity = 13.123456

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
  const createdMovements = []
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
    if (pathname === '/api/v1/lookups/units') return json(route, [{ id: 1, code: 'kg', name: 'Kiloqram' }, { id: 2, code: 'g', name: 'Qram' }])
    if (pathname === '/api/v1/lookups/inventory-movement-types') return json(route, [{ id: 1, code: 'Purchase', name: 'Alış' }, { id: 2, code: 'ManualIncrease', name: 'Əl ilə artım' }])
    if (pathname === '/api/v1/restaurants/1/inventory') return json(route, { items: [item, { ...item, id: 23, name: 'Uzunadlıstokelementininmobilgörünüşüyoxlanılır' }], pageIndex: 1, totalPages: 1, totalCount: 2, hasPreviousPage: false, hasNextPage: false })
    if (pathname === '/api/v1/restaurants/1/inventory/22') return json(route, { ...item, quantityOnHand: currentQuantity, hasUnknownStockCost })
    if (pathname === '/api/v1/restaurants/1/inventory/22/movements') {
      if (route.request().method() === 'POST') {
        createdMovements.push(route.request().postDataJSON())
        return json(route, {})
      }
      historyRequests++
      if (failHistory) return json(route, { message: 'History unavailable' }, 503)
      const pageNumber = Number(url.searchParams.get('PageNumber') || url.searchParams.get('pageNumber') || 1)
      const all = [
        movement(1, 1, 10, { unitCode: 'ml', reason: 'Təchizatçıdan alındı', purchaseUnitPrice: 0.005, purchaseCostAmount: 0.05 }),
        movement(2, 4, -0.123456, { relatedOrderId: 'ABC-42', relatedOrderItemId: 99, orderItemName: 'Uzun espresso sifarişi', orderItemQuantity: 2, tableNo: 12, reason: 'Internal processing', purchaseUnitPrice: 1, purchaseCostAmount: 2 }),
        movement(3, 6, 0.123456, { reversedMovementId: 2, relatedOrderId: 'ABC-42', orderItemName: 'Uzun espresso sifarişi', orderItemQuantity: 2, tableNo: 12 }),
        movement(4, 6, 1, { reason: 'Manual return', reversedMovementId: null }),
        movement(5, 1, 1, { purchaseUnitPrice: 0, purchaseCostAmount: 0 }),
        movement(6, 1, 1),
        movement(7, 1, 1, { purchaseUnitPrice: 0.00000005, purchaseCostAmount: 0.00000005 }),
        ...Array.from({ length: 4 }, (_, index) => movement(index + 8, 2, 1)),
      ]
      return json(route, { items: pageNumber === 1 ? all.slice(0, 10) : all.slice(10), pageIndex: pageNumber, totalPages: 2, totalCount: 11, hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber < 2 })
    }
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    return json(route, {})
  })

  await page.goto(`${origin}/admin/inventory/movements/new?restaurantId=1&inventoryItemId=22`)
  const price = page.locator('input[name="purchaseUnitPrice"]')
  await price.waitFor()
  const form = page.locator('form').filter({ has: price })
  const movementForm = page.locator('form.stack-form')
  const movementType = movementForm.locator('select').first()
  const unit = movementForm.locator('select').nth(1)
  const quantity = movementForm.locator('input[type="number"]')
  const submit = movementForm.locator('button[type="submit"]')
  await quantity.fill('1')
  await submit.click()
  assert.equal(createdMovements.length, 0)
  assert.equal(await price.evaluate((input) => input.validity.valueMissing), true)
  await price.fill('9.99')
  await unit.selectOption('1')
  assert.equal(await price.inputValue(), '')
  assert.match(await form.innerText(), /1 Kiloqram \(kg\)/)
  for (const value of ['-1', '1000000.01', '0.1234567']) {
    await price.fill(value)
    await submit.click()
    assert.equal(await price.getAttribute('aria-invalid'), 'true')
    assert.equal(createdMovements.length, 0)
  }
  await price.fill('12,123456')
  await page.screenshot({ path: path.join(dist, 'inventory-purchase-price-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 320, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await form.screenshot({ path: path.join(dist, 'inventory-purchase-price-320.png') })
  await submit.click()
  await page.getByText('Stok hərəkəti əlavə edildi.').waitFor()
  assert.deepEqual(createdMovements[0], { movementTypeId: 1, quantity: 1, unitId: 1, reason: null, purchaseUnitPrice: 12.123456 })
  await quantity.fill('1')
  await price.fill('0')
  await submit.click()
  await page.waitForFunction(() => document.querySelector('input[name="purchaseUnitPrice"]')?.value === '')
  assert.equal(createdMovements[1].purchaseUnitPrice, 0)
  await quantity.fill('1')
  await price.fill('22')
  await movementType.selectOption('2')
  assert.equal(await price.count(), 0)
  await submit.click()
  await page.waitForFunction(() => document.querySelector('form.stack-form input[type="number"]')?.value === '')
  assert.deepEqual(createdMovements[2], { movementTypeId: 2, quantity: 1, unitId: 2, reason: null })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${origin}/admin/inventory/movements?restaurantId=1`)
  const opener = page.getByRole('button', { name: 'Espresso tarixçəsinə bax' })
  await opener.waitFor()
  const sidebar = page.locator('.admin-sidebar')
  assert.equal(await sidebar.getByRole('button', { name: 'Stok və reseptlər' }).getAttribute('aria-expanded'), 'true')
  assert.equal(await sidebar.locator('nav a[aria-current="page"]').getAttribute('href'), '/admin/inventory/movements')
  assert.equal(historyRequests, 0, 'history must not preload')
  assert.equal(await page.locator('.admin-sidebar nav a.active').count(), 1)
  const tableShell = page.locator('.inventory-table-shell')
  for (const [width, height, rowDisplay] of [[390, 844, 'grid'], [844, 390, 'table-row'], [667, 375, 'table-row'], [320, 740, 'grid']]) {
    await page.setViewportSize({ width, height })
    const layout = await tableShell.evaluate((shell) => {
      const bounds = shell.getBoundingClientRect()
      return {
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        tableFits: shell.scrollWidth <= shell.clientWidth + 1,
        rowDisplay: getComputedStyle(shell.querySelector('tbody tr')).display,
        actionsFit: [...shell.querySelectorAll('.inventory-table-actions button')].every((button) => {
          const box = button.getBoundingClientRect()
          return box.width >= 44 && box.height >= 44 && box.left >= bounds.left && box.right <= bounds.right
        }),
      }
    })
    assert.deepEqual(layout, { pageFits: true, tableFits: true, rowDisplay, actionsFit: true }, `${width}x${height}`)
    await opener.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(dist, `inventory-movements-${width}x${height}.png`) })
  }
  await page.setViewportSize({ width: 844, height: 390 })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Espresso' })
  await dialog.waitFor()
  await dialog.getByText('Ləğv səbəbilə qaytarıldı').waitFor()
  assert.equal(await dialog.getByText('Stoka qaytarma').count(), 1)
  assert.equal(await dialog.getByText('Hazırlanma üçün sərf edildi').count(), 1)
  assert.match(await dialog.locator('.inventory-history-row time').first().innerText(), /14:00/)
  assert.equal(await dialog.getByText('Cari stok').count(), 1)
  assert.match(await dialog.locator('.inventory-history-balance').innerText(), /13[,.]123456/)
  const costRows = dialog.locator('.inventory-history-row')
  await dialog.locator('.inventory-history-balance').getByText('Maya məlum deyil').waitFor()
  assert.match(await costRows.nth(0).locator('dd').first().innerText(), /0[.,]005.*\/ml$/)
  assert.match(await costRows.nth(0).locator('dd').last().innerText(), /0[.,]05/)
  assert.equal(await costRows.nth(1).locator('.inventory-history-cost').count(), 0)
  assert.match(await costRows.nth(4).locator('dd').last().innerText(), /0[.,]00/)
  assert.equal(await costRows.nth(4).getByText('Maya məlum deyil').count(), 0)
  await costRows.nth(5).getByText('Maya məlum deyil').waitFor()
  assert.match(await costRows.nth(6).locator('dd').first().innerText(), /0[.,]00000005/)
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
  assert.equal(await dialog.getByText('Total purchase amount', { exact: true }).count(), 3)
  await dialog.getByRole('button', { name: 'Close history' }).click()
  hasUnknownStockCost = undefined
  await page.getByRole('button', { name: /Language: English/ }).click()
  await page.getByRole('button', { name: 'Русский' }).click()
  await page.getByRole('button', { name: 'История движения Espresso' }).click()
  await dialog.getByText('Возвращено после отмены').waitFor()
  assert.match(await dialog.locator('.inventory-history-balance').innerText(), /13[,.]123456 шт\./)
  assert.equal(await dialog.locator('.inventory-history-balance .inventory-history-cost-unknown').count(), 0)
  await dialog.getByText('Общая сумма закупки', { exact: true }).first().waitFor()
  await page.keyboard.press('Escape')
  hasUnknownStockCost = true
  currentQuantity = 0
  await page.getByRole('button', { name: 'История движения Espresso' }).click()
  await dialog.locator('.inventory-history-balance strong').waitFor()
  assert.equal(await dialog.locator('.inventory-history-balance .inventory-history-cost-unknown').count(), 0)
  assert.deepEqual(pageErrors, [])
  console.log('PASS inventory history: purchase costs, current stock, 3 locales, 3 viewports x 2 themes, pagination, focus, error retry')
} finally {
  await browser.close()
}
