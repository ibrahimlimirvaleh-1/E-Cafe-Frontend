import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Admin', email: 'qa@example.com', roleId: '1', roleName: 'Platform Admin', permissions: [] })).toString('base64url')}.signature`
const restaurants = [
  { id: 1, name: 'First Bistro', location: 'Baku', hasActiveContract: true, isActive: true },
  { id: 2, name: 'Second Bistro', location: 'Baku', hasActiveContract: true, isActive: true },
]
const updates = []
const contentRequests = []
const categoryUpdates = []
let englishTableName = 'Table One'
let groupCreateBody = null

function json(route, data, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      const original = Storage.prototype[method]
      Storage.prototype[method] = function (key, ...args) {
        if (String(key).startsWith('ecafe.adminRestaurant.')) throw new DOMException('Blocked storage', 'SecurityError')
        return original.call(this, key, ...args)
      }
    }
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    if (pathname.startsWith('/api/v1/')) {
      if (pathname.startsWith('/api/v1/content/')) contentRequests.push(pathname)
      if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
      if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Admin', roleId: 1, isActive: true })
      if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
      if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) return json(route, { language: pathname.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
      if (pathname === '/api/v1/restaurants/getAll') return json(route, restaurants)
      if (pathname === '/api/v1/restaurant/getById/2') return json(route, { id: 2, name: 'Second Bistro', location: 'Baku', branchName: 'Central', phone: '+994501234567', hasActiveContract: true, isActive: true })
      if (pathname === '/api/v1/restaurant-groups') {
        if (request.method() === 'POST') {
          groupCreateBody = JSON.parse(request.postData() || '{}')
          return json(route, { id: 5, ...groupCreateBody }, 201)
        }
        return json(route, [])
      }
      if (pathname === '/api/v1/lookups/units') return json(route, [{ id: 2, name: 'Gram', code: 'g' }])
      if (pathname === '/api/v1/lookups/inventory-movement-types') return json(route, [])
      if (pathname === '/api/v1/lookups/item-statuses') return json(route, [{ id: 1, code: 'Available', name: 'Mövcuddur' }])
      if (pathname === '/api/v1/category/2') return json(route, [{ id: 3, restaurantId: 2, name: 'Drinks', sortOrder: 1, isActive: true }])
      if (pathname === '/api/v1/content/categories/3/translations') return json(route, { entityType: 'categories', id: 3, restaurantId: 2, translations: [{ languageCode: 'az', name: 'İçkilər', revision: 1 }, { languageCode: 'en', name: 'Drinks', revision: 1 }] })
      if (pathname === '/api/v1/restaurants/2/categories/3' && request.method() === 'PUT') {
        categoryUpdates.push(JSON.parse(request.postData() || '{}'))
        return json(route, { id: 3, restaurantId: 2, name: 'Drinks', sortOrder: 1, isActive: true })
      }
      if (pathname === '/api/v1/items/getAll') return json(route, { items: [{ id: 9, restaurantId: 2, categoryId: 3, categoryName: 'Drinks', name: 'Tea', description: 'Hot tea', basePrice: 4, statusId: 1, statusName: 'Mövcuddur', isActive: true }], pageIndex: 1, totalPages: 1, totalCount: 1 })
      if (/^\/api\/v1\/restaurants\/\d+\/inventory$/.test(pathname)) {
        const restaurantId = pathname.split('/')[4]
        return json(route, restaurantId === '2' ? [{ id: 22, restaurantId: 2, name: 'Second stock', unitId: 2, quantityOnHand: 15, lowStockThreshold: 3, isActive: true }] : [])
      }
      if (pathname === '/api/v1/restaurants/2/inventory/22') {
        if (request.method() === 'PUT') {
          updates.push({ type: 'inventory', body: JSON.parse(request.postData() || '{}') })
          return json(route, {})
        }
        return json(route, { id: 22, restaurantId: 2, name: 'Second stock', unitId: 2, quantityOnHand: 15, lowStockThreshold: 3, isActive: true })
      }
      if (pathname === '/api/v1/content/inventory-items/22/translations') {
        return json(route, { entityType: 'inventory-items', id: 22, restaurantId: 2, translations: [{ languageCode: 'az', name: 'Second stock', revision: 1 }, { languageCode: 'en', name: 'Second stock EN', revision: 1 }] })
      }
      if (pathname === '/api/v1/restaurants/2/tables') {
        return json(route, [{ id: 7, restaurantId: 2, tableNo: '1', name: request.headers()['accept-language']?.startsWith('en') ? englishTableName : 'Masa-1', capacity: 2, status: 'Available', isActive: true }])
      }
      if (pathname === '/api/v1/restaurants/2/tables/7' && request.method() === 'PUT') {
        const body = JSON.parse(request.postData() || '{}')
        updates.push({ type: 'table', body })
        englishTableName = body.translations?.find((translation) => translation.languageCode === 'en')?.name || englishTableName
        return json(route, {})
      }
      if (pathname === '/api/v1/content/tables/7/translations') {
        return json(route, { entityType: 'tables', id: 7, restaurantId: 2, translations: [{ languageCode: 'az', name: 'Masa-1', revision: 1 }, { languageCode: 'en', name: englishTableName, revision: 1 }] })
      }
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })

  await page.goto(`${origin}/admin/inventory/new?inventoryItemId=22`)
  await page.getByRole('heading', { name: /stoku redakt/i }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: 'Ad', exact: true }).inputValue(), 'Second stock')
  assert.match(page.url(), /restaurantId=2/)
  await page.getByRole('button', { name: /stoku yenil/i }).click()
  await page.getByText('Stok elementi yeniləndi.').waitFor()
  assert.equal(updates.find((update) => update.type === 'inventory')?.body.name, 'Second stock')
  await page.getByRole('link', { name: 'Menyu', exact: true }).click()
  await page.waitForURL(/\/admin\/menu\?restaurantId=2/)
  assert.match(page.url(), /\/admin\/menu\?restaurantId=2/)
  await page.goBack()
  assert.match(page.url(), /restaurantId=2/)

  await page.getByRole('button', { name: /Dil: Azərbaycanca/ }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await page.goto(`${origin}/admin/categories/3/edit?restaurantId=2`)
  await page.getByRole('textbox', { name: 'Name', exact: true }).waitFor()
  await page.getByRole('button', { name: /Save/i }).click()
  await page.getByText('Category details updated.').waitFor()
  assert.equal(categoryUpdates.at(-1)?.name, 'İçkilər')
  await page.screenshot({ path: path.join(dist, 'admin-flow-desktop.png'), fullPage: true })
  await page.goto(`${origin}/admin/menu?restaurantId=2`)
  await page.getByText('Tea', { exact: true }).waitFor()
  await page.getByText('Available', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Language: English/ }).click()
  await page.getByRole('button', { name: 'Русский' }).click()
  await page.getByText('В наличии', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Язык: Русский/ }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await page.goto(`${origin}/admin/tables/7/edit?restaurantId=2`)
  await page.getByRole('tab', { name: 'EN' }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Window table')
  await page.getByRole('button', { name: /Save/i }).click()
  await page.getByText('Table details updated.').waitFor()
  assert.equal(updates.find((update) => update.type === 'table')?.body.translations?.find((row) => row.languageCode === 'en')?.name, 'Window table')
  await page.goto(`${origin}/admin/tables?restaurantId=2`)
  await page.getByText('Window table').waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const mobileRow = await page.locator('.table-management-row').first().evaluate((row) => {
    const info = row.querySelector('.table-management-info').getBoundingClientRect()
    const badge = row.querySelector('.ui-badge').getBoundingClientRect()
    const actions = row.querySelector('.inline-actions').getBoundingClientRect()
    return { infoBottom: info.bottom, badgeTop: badge.top, badgeBottom: badge.bottom, actionsTop: actions.top }
  })
  assert.ok(mobileRow.badgeTop >= mobileRow.infoBottom)
  assert.ok(mobileRow.actionsTop >= mobileRow.badgeBottom)
  await page.screenshot({ path: path.join(dist, 'admin-flow-mobile.png'), fullPage: true })
  await page.goto(`${origin}/admin/restaurant-groups/new`)
  assert.equal(await page.getByRole('tab', { name: 'EN' }).count(), 0)
  await page.getByRole('textbox', { name: /group name/i }).fill('Caspian Group')
  await page.getByRole('textbox', { name: /email/i }).fill('group@example.com')
  await page.getByRole('button', { name: /create group/i }).click()
  await page.getByText(/group created/i).waitFor()
  assert.equal(groupCreateBody?.name, 'Caspian Group')
  assert.equal('translations' in groupCreateBody, false)
  await page.goto(`${origin}/admin/restaurants/2/edit`)
  await page.getByRole('heading', { name: 'Second Bistro' }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'EN' }).count(), 0)
  assert.equal(contentRequests.some((request) => /restaurants|restaurant-groups/.test(request)), false)
  await page.goto(`${origin}/admin/contracts`)
  await page.getByRole('button', { name: /^All\b/ }).first().waitFor()
  await page.getByRole('button', { name: /Filter/i }).click()
  await page.getByText('All restaurants').waitFor()
  assert.deepEqual(pageErrors, [])
  console.log('Admin localization flow smoke passed')
} finally {
  await browser.close()
}
