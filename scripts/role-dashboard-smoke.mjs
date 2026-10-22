import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const requests = []

function token(roleId) {
  const body = { userId: `user-${roleId}`, name: 'Test', surname: 'User', email: 'test@example.com', roleId: String(roleId), roleName: 'Test', restaurantId: roleId === 1 ? undefined : '1', restaurantRoles: roleId === 1 ? [] : [`1:${roleId}`] }
  return `header.${Buffer.from(JSON.stringify(body)).toString('base64url')}.signature`
}

function dashboard(view, params) {
  const mode = params.get('paymentMode') || 'real'
  const page = Number(params.get('pageIndex') || 1)
  const metricsByView = {
    platform: { activeRestaurants: 18, activeUsers: 1248, reservationCount: 326, activeContracts: 17 },
    owner: mode === 'test'
      ? { orderAmount: 980, collectedAmount: 900, orderCount: 14, averageOrder: 70 }
      : { orderAmount: 6480, collectedAmount: 6120, orderCount: 84, averageOrder: 77.14 },
    manager: { todayReservations: 24, openSessions: 8, kitchenOrders: 11, readyOrders: 4 },
  }
  const chartValues = view === 'owner'
    ? mode === 'test' ? [100, 120, 90, 150, 170, 180, 170] : [740, 820, 610, 1080, 960, 1220, 1050]
    : view === 'platform' ? [32, 46, 38, 57, 41, 64, 48] : [2, 4, 3, 8, 6, 5, 7]
  const financials = mode === 'test'
    ? { collectedAmount: 900, refundedAmount: 80, netCollectedAmount: 820, depositCollectedAmount: 300, sessionCollectedAmount: 600 }
    : { collectedAmount: 6120, refundedAmount: 120, netCollectedAmount: 6000, depositCollectedAmount: 2120, sessionCollectedAmount: 4000 }
  return {
    view, generatedAtUtc: '2026-10-22T10:00:00Z', from: view === 'manager' ? '2026-10-22' : '2026-10-16', to: '2026-10-22', timeZone: 'Asia/Baku', paymentMode: mode,
    restaurants: [{ id: 1, name: 'Dolce Vita', branchName: 'Port Baku', timeZone: 'Asia/Baku' }, { id: 2, name: 'Buta Baku', branchName: 'Neftçilər', timeZone: 'Asia/Baku' }], hasMoreRestaurants: false,
    metrics: Object.entries(metricsByView[view]).map(([key, value]) => ({ key, value, unit: ['orderAmount', 'collectedAmount', 'averageOrder'].includes(key) ? 'AZN' : 'count', previousValue: view === 'manager' || ['activeRestaurants', 'activeUsers', 'activeContracts'].includes(key) ? null : 10, changePercent: key === 'orderAmount' ? 12.5 : null })),
    financials: view === 'manager' ? null : financials,
    chart: { key: view === 'platform' ? 'reservationCount' : view === 'owner' ? 'orderAmount' : 'orderCount', unit: view === 'owner' ? 'AZN' : 'count', granularity: view === 'manager' ? 'hour' : 'day', points: chartValues.map((value, index) => ({ bucketStartUtc: view === 'manager' ? `2026-10-22T${String(8 + index).padStart(2, '0')}:00:00Z` : `2026-10-${String(16 + index).padStart(2, '0')}T08:00:00Z`, value })) },
    alerts: [{ key: 'lowStock', count: 2, tone: 'warning', restaurantId: 1 }, { key: 'readyOrders', count: 0, tone: 'warning', restaurantId: 1 }],
    branchRows: view === 'manager' ? [] : [{ restaurantId: page, name: page === 1 ? 'Dolce Vita' : 'Buta Baku', branchName: 'Port Baku', isActive: true, reservationCount: 12, orderCount: 15, orderAmount: 700, collectedAmount: 600, refundedAmount: 10, contractId: 4, contractStatusId: 3, contractEndsAt: '2026-11-20T20:00:00Z' }],
    sessionRows: view !== 'manager' ? [] : [{ sessionId: 10, restaurantId: 1, tableId: 1, tableName: 'Masa-1', waiterName: 'Eldegiz', reservationId: 4, guestCount: 2, openedAt: '2026-10-22T08:00:00Z', orderAmount: 0, remainingAmount: 0, preparingCount: 1, readyCount: 0, hasPendingPayment: false, requiresReview: true }],
    pageIndex: page, pageSize: 10, totalRows: view === 'manager' ? 1 : 15,
  }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  for (const [roleId, view] of [[1, 'platform'], [2, 'owner'], [3, 'manager']]) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(`${origin}/**`, async (route) => {
      const url = new URL(route.request().url())
      const name = url.pathname
      if (name.startsWith('/api/v1/')) {
        const reply = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
        if (name === '/api/v1/user/refresh') return reply({ accessToken: token(roleId) })
        if (name === '/api/v1/profile') return reply({ userId: `user-${roleId}`, name: 'Test', surname: 'User', roleId, isActive: true, profiles: roleId === 1 ? [] : [{ restaurantId: 1, restaurantName: 'Dolce Vita · Port Baku', roleId, roleName: 'Test', isActive: true }] })
        if (name === '/api/v1/localization/preference') return reply({ language: 'az' })
        if (/^\/api\/v1\/localization\/dictionaries\//.test(name)) return reply({ language: name.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
        if (name === `/api/v1/dashboard/${view}`) {
          requests.push({ view, search: url.searchParams.toString() })
          return reply(dashboard(view, url.searchParams))
        }
        if (name.endsWith('/notifications')) return reply({ items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
        if (name.endsWith('/unread-count')) return reply({ count: 0 })
        return reply({})
      }
      const file = path.join(dist, name === '/' || !path.extname(name) ? 'index.html' : name.slice(1))
      if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
    })
    await page.goto(`${origin}/admin`)
    await page.locator('.role-dashboard-metric').first().waitFor()
    assert.equal(await page.locator('.role-dashboard-metric').count(), 4)
    assert.equal(await page.locator('.role-dashboard-alerts li').count(), 1)
    assert.equal(await page.locator('.role-dashboard-financials').count(), view === 'manager' ? 0 : 1)
    assert.equal(await page.locator('.role-dashboard-table-scroll tbody tr').count(), 1)
    if (view === 'manager') {
      assert.match(requests.find((item) => item.view === view).search, /restaurantId=1/)
      assert.equal(await page.locator('.role-dashboard-table-scroll tbody td').nth(3).innerText(), '—')
      assert.equal(await page.locator('.role-dashboard-table-scroll tbody td').nth(4).innerText(), '—')
      await page.getByText('Yoxlanmalıdır', { exact: true }).waitFor()
    } else await page.getByText('Aktiv', { exact: true }).waitFor()
    if (view === 'platform') {
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="en"]').click()
      await page.getByRole('heading', { name: 'ECafe at a glance' }).waitFor()
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="ru"]').click()
      await page.getByRole('heading', { name: 'ECafe в цифрах' }).waitFor()
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="az"]').click()
      await page.getByRole('heading', { name: 'ECafe-nin ümumi mənzərəsi' }).waitFor()
      await page.locator('.theme-toggle').click()
      await page.screenshot({ path: path.join(dist, 'role-dashboard-platform-dark.png'), fullPage: true })
      await page.locator('.theme-toggle').click()
    }
    await page.screenshot({ path: path.join(dist, `role-dashboard-${view}-desktop.png`), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, `role-dashboard-${view}-mobile.png`), fullPage: true })
    if (view === 'owner') {
      assert.match(await page.locator('.role-dashboard-metric strong').first().innerText(), /₼/)
      await page.getByRole('button', { name: 'Test', exact: true }).click()
      await page.getByText('Yalnız test ödənişləri').waitFor()
      assert.match(requests.at(-1).search, /paymentMode=test/)
      await page.getByRole('button', { name: '2', exact: true }).click()
      await page.getByText('Buta Baku', { exact: true }).waitFor()
      assert.match(requests.at(-1).search, /pageIndex=2/)
    }
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('Role dashboard smoke passed')
} finally {
  await browser.close()
}
