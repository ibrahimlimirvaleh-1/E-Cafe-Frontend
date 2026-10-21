import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Admin', email: 'qa@example.com', roleId: '1', roleName: 'Platform Admin', permissions: [] })).toString('base64url')}.signature`
const roles = [
  { id: 1, code: 'PlatformAdmin', name: 'Platforma admini', isStaffAssignable: true },
  { id: 2, code: 'Owner', name: 'Sahibkar', isStaffAssignable: true },
  { id: 3, code: 'Manager', name: 'Menecer', isStaffAssignable: true },
  { id: 4, code: 'Waiter', name: 'Ofisiant', isStaffAssignable: true },
  { id: 5, code: 'Customer', name: 'Müştəri', isStaffAssignable: true },
  { id: 6, code: 'Kitchen', name: 'Mətbəx', isStaffAssignable: true },
  { id: 99, code: 'Special', name: 'Xüsusi rol', isStaffAssignable: true },
]
const staff = [
  { id: 11, restaurantId: 1, name: 'Aysel', surname: 'Chef', roleId: 6, roleName: 'Mətbəx', isActive: true, phone: '+994501234567' },
  { id: 12, restaurantId: 1, name: 'Murad', surname: 'Manager', roleId: 3, roleName: 'Menecer', isActive: true, phone: '+994501234568' },
  { id: 13, restaurantId: 1, name: 'Lala', surname: 'Owner', roleId: 2, roleName: 'Sahibkar', isActive: true, phone: '+994501234569' },
]
const roleUpdates = []

function json(route, data, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    if (pathname.startsWith('/api/v1/')) {
      if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
      if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Admin', roleId: 1, isActive: true })
      if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
      if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) return json(route, { language: pathname.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
      if (pathname === '/api/v1/restaurants/getAll') return json(route, [{ id: 1, name: 'Dolce Vita Port Baku', location: 'Baku', hasActiveContract: true, isActive: true }])
      if (pathname === '/api/v1/lookups/roles') return json(route, roles)
      if (pathname === '/api/v1/staff/1') return json(route, staff)
      if (/^\/api\/v1\/users\/\d+\/role$/.test(pathname) && request.method() === 'PATCH') {
        roleUpdates.push({ path: pathname, roleId: url.searchParams.get('roleId'), restaurantId: url.searchParams.get('restaurantId') })
        return json(route, {})
      }
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })

  await page.goto(`${origin}/admin/staff?restaurantId=1`)
  await page.getByText('Aysel Chef').waitFor()
  const aysel = page.locator('.staff-member-row').filter({ hasText: 'Aysel Chef' })
  const murad = page.locator('.staff-member-row').filter({ hasText: 'Murad Manager' })
  const lala = page.locator('.staff-member-row').filter({ hasText: 'Lala Owner' })
  await aysel.locator('.staff-badges .ui-badge-info').getByText('Mətbəx', { exact: true }).waitFor()
  await murad.locator('.staff-badges .ui-badge-info').getByText('Menecer', { exact: true }).waitFor()
  await lala.locator('.staff-badges .ui-badge-info').getByText('Sahibkar', { exact: true }).waitFor()

  await page.getByRole('button', { name: /Dil: Azərbaycanca/ }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await aysel.locator('.staff-badges .ui-badge-info').getByText('Kitchen', { exact: true }).waitFor()
  await murad.locator('.staff-badges .ui-badge-info').getByText('Manager', { exact: true }).waitFor()
  await lala.locator('.staff-badges .ui-badge-info').getByText('Owner', { exact: true }).waitFor()
  assert.equal(await murad.locator('select').locator('option[value="6"]').textContent(), 'Kitchen')
  assert.equal(await murad.locator('select').locator('option[value="99"]').textContent(), 'Xüsusi rol')
  await page.goto(`${origin}/admin/staff/new?restaurantId=1`)
  await page.locator('select').locator('option[value="3"]').first().waitFor({ state: 'attached' })
  assert.equal(await page.locator('select').locator('option[value="3"]').first().textContent(), 'Manager')
  await page.goto(`${origin}/admin/staff?restaurantId=1`)
  await murad.locator('.staff-badges .ui-badge-info').getByText('Manager', { exact: true }).waitFor()

  await page.getByRole('button', { name: /Language: English/ }).click()
  await page.getByRole('button', { name: 'Русский' }).click()
  await aysel.locator('.staff-badges .ui-badge-info').getByText('Кухня', { exact: true }).waitFor()
  await murad.locator('.staff-badges .ui-badge-info').getByText('Менеджер', { exact: true }).waitFor()
  await lala.locator('.staff-badges .ui-badge-info').getByText('Владелец', { exact: true }).waitFor()
  assert.equal(await murad.locator('select').locator('option[value="6"]').textContent(), 'Кухня')
  await page.screenshot({ path: path.join(dist, 'staff-role-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const mobileRoleSelect = await murad.locator('select').evaluate((select) => {
    const selectBounds = select.getBoundingClientRect()
    const actionBounds = select.parentElement.getBoundingClientRect()
    return { left: selectBounds.left, right: selectBounds.right, parentLeft: actionBounds.left, parentRight: actionBounds.right }
  })
  assert.ok(mobileRoleSelect.left >= mobileRoleSelect.parentLeft)
  assert.ok(mobileRoleSelect.right <= mobileRoleSelect.parentRight)
  await page.screenshot({ path: path.join(dist, 'staff-role-mobile.png'), fullPage: true })

  await murad.locator('select').selectOption('6')
  const roleUpdated = page.waitForResponse((response) => response.url().includes('/api/v1/users/12/role') && response.request().method() === 'PATCH')
  await murad.getByRole('button', { name: /rolu yenilə/ }).click()
  await roleUpdated
  assert.deepEqual(roleUpdates, [{ path: '/api/v1/users/12/role', roleId: '6', restaurantId: '1' }])
  assert.deepEqual(pageErrors, [])
  console.log('Staff role localization smoke passed')
} finally {
  await browser.close()
}
