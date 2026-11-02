import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = 'http://localhost:53220'
const dist = path.resolve('dist')
const requests = []
let exportOverLimit = false
let slowNextReport = false
let emptyNextReport = false
let failNextReport = false
let slowNextExport = false

function token(roleId) {
  return `header.${Buffer.from(JSON.stringify({ userId: `user-${roleId}`, name: 'Test', surname: 'User', roleId: String(roleId), restaurantId: roleId === 3 ? '1' : null, restaurantRoles: roleId === 3 ? ['1:3'] : [] })).toString('base64url')}.signature`
}

function json(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function overview(view, params) {
  const period = params.get('period') || (view === 'manager' ? 'today' : 'week')
  const from = period === 'today' ? '2026-11-02' : period === 'month' ? '2026-10-04' : '2026-10-27'
  const metricsByView = {
    platform: { activeRestaurants: 18, activeUsers: 1248, reservationCount: 326, activeContracts: 17 },
    owner: { orderAmount: 6480, collectedAmount: 6120, orderCount: 84, averageOrder: 77.14 },
    manager: { todayReservations: 24, openSessions: 8, kitchenOrders: 11, readyOrders: 4 },
  }
  return {
    view, generatedAtUtc: '2026-11-02T10:00:00Z', from, to: '2026-11-02', timeZone: 'Asia/Baku', paymentMode: params.get('paymentMode') || 'real',
    restaurants: [{ id: 1, name: 'Dolce Vita', branchName: 'Port Baku', timeZone: 'Asia/Baku' }, { id: 2, name: 'Buta', branchName: null, timeZone: 'Asia/Baku' }], hasMoreRestaurants: false,
    metrics: Object.entries(metricsByView[view]).map(([key, value]) => ({ key, value, unit: ['orderAmount', 'collectedAmount', 'averageOrder'].includes(key) ? 'AZN' : 'count', previousValue: null, changePercent: null })),
    financials: view === 'manager' ? null : { collectedAmount: 40, refundedAmount: 5, netCollectedAmount: 35, depositCollectedAmount: 20, sessionCollectedAmount: 20 },
    chart: { key: 'orderCount', unit: 'count', granularity: 'day', points: [3, 6, 4, 9, 5, 8, 7].map((value, index) => ({ bucketStartUtc: new Date(Date.UTC(2026, 9, 27 + index, 8)).toISOString(), value })) },
    alerts: [{ key: 'lowStock', count: 2, tone: 'warning', restaurantId: 1 }],
    branchRows: view === 'manager' ? [] : [{ restaurantId: 1, name: 'Dolce Vita', branchName: 'Port Baku', isActive: true, reservationCount: 12, orderCount: 15, orderAmount: 700, collectedAmount: 600, refundedAmount: 10, contractId: 1, contractStatusId: 6003, contractEndsAt: '2026-11-20T20:00:00Z' }],
    sessionRows: view === 'manager' ? [{ sessionId: 10, restaurantId: 1, tableId: 1, tableName: 'Masa-1', waiterName: 'Eldegiz', reservationId: 4, guestCount: 2, openedAt: '2026-11-02T08:00:00Z', orderAmount: 0, remainingAmount: 0, preparingCount: 1, readyCount: 0, hasPendingPayment: false, requiresReview: true }] : [],
    pageIndex: 1, pageSize: 10, totalRows: 1,
  }
}

function report(view, params) {
  const kind = params.get('kind') || 'orders'
  const pageIndex = Number(params.get('pageIndex') || 1)
  const list = Array.from({ length: pageIndex === 1 ? 20 : 5 }, (_, index) => (pageIndex - 1) * 20 + index + 1)
  return {
    kind, generatedAtUtc: '2026-11-02T10:00:00Z', timeZone: 'Asia/Baku', from: '2026-10-27', to: '2026-11-02', paymentMode: params.get('paymentMode') || 'real',
    metrics: kind === 'orders' ? [
      { key: 'totalOrders', value: 25, unit: 'count', previousValue: null, changePercent: null },
      { key: 'pendingOrders', value: 2, unit: 'count', previousValue: null, changePercent: null },
      { key: 'cancelledOrders', value: 1, unit: 'count', previousValue: null, changePercent: null },
      { key: 'totalItems', value: 48, unit: 'count', previousValue: null, changePercent: null },
      ...(view === 'manager' ? [] : [{ key: 'confirmedAmount', value: 65, unit: 'AZN', previousValue: null, changePercent: null }]),
    ] : kind === 'reservations' ? [{ key: 'totalReservations', value: 25, unit: 'count', previousValue: null, changePercent: null }, { key: 'totalGuests', value: 50, unit: 'count', previousValue: null, changePercent: null }, { key: 'arrivedReservations', value: 20, unit: 'count', previousValue: null, changePercent: null }, { key: 'seatedReservations', value: 18, unit: 'count', previousValue: null, changePercent: null }]
      : [{ key: 'collectedAmount', value: 40, unit: 'AZN', previousValue: null, changePercent: null }, { key: 'refundedAmount', value: 5, unit: 'AZN', previousValue: null, changePercent: null }, { key: 'netCollectedAmount', value: 35, unit: 'AZN', previousValue: null, changePercent: null }, { key: 'receiptCount', value: 12, unit: 'count', previousValue: null, changePercent: null }, { key: 'refundCount', value: 2, unit: 'count', previousValue: null, changePercent: null }],
    orders: kind === 'orders' ? list.map((id) => ({ id, restaurantId: 1, restaurantName: 'Dolce Vita', tableName: 'Masa-1', tableSessionId: 21, sourceId: 1, statusId: id === 1 ? 2009 : id === 2 ? 2007 : 2005, openedAtUtc: '2026-11-02T08:00:00Z', sentToKitchenAtUtc: id === 1 ? null : '2026-11-02T08:01:00Z', servedAtUtc: id < 3 ? null : '2026-11-02T08:20:00Z', itemQuantity: 2, itemSubtotal: 15, confirmedAmount: id < 3 ? 0 : 15 })) : [],
    reservations: kind === 'reservations' ? list.map((id) => ({ id, restaurantId: 1, restaurantName: 'Dolce Vita', tableName: 'Masa-1', statusId: id === 1 ? 1002 : 1005, reservedAtUtc: '2026-11-02T13:00:00Z', peopleCount: 2, depositAmount: 20, arrivedAtUtc: id === 1 ? '2026-11-02T12:55:00Z' : null, seatedAtUtc: id === 1 ? '2026-11-02T13:00:00Z' : null })) : [],
    payments: kind === 'payments' ? [{ id: 1, event: 'receipt', restaurantId: 1, restaurantName: 'Dolce Vita', occurredAtUtc: '2026-11-02T08:00:00Z', amount: 40, purpose: 'deposit', reservationId: 1, tableSessionId: null, statusId: 3002, isTest: params.get('paymentMode') === 'test' }, { id: 1, event: 'refund', restaurantId: 1, restaurantName: 'Dolce Vita', occurredAtUtc: '2026-11-02T09:00:00Z', amount: 5, purpose: 'deposit', reservationId: 1, tableSessionId: null, statusId: 8005, isTest: params.get('paymentMode') === 'test' }] : [],
    pageIndex, pageSize: 20, totalRows: kind === 'payments' ? 2 : 25,
  }
}

async function openPage(browser, roleId, view) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url())
    const name = url.pathname
    if (name.startsWith('/api/v1/')) {
      if (name === '/api/v1/user/refresh') return json(route, { accessToken: token(roleId) })
      if (name === '/api/v1/profile') return json(route, { userId: `user-${roleId}`, name: 'Test', surname: 'User', roleId, restaurantId: roleId === 3 ? 1 : null, isActive: true, profiles: roleId === 3 ? [{ restaurantId: 1, restaurantName: 'Dolce Vita', roleId, roleName: 'Manager', isActive: true }] : [] })
      if (name === '/api/v1/localization/preference') return json(route, { language: 'az' })
      if (name.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
      if (name.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (name.endsWith('/unread-count')) return json(route, { count: 0 })
      if (name === `/api/v1/dashboard/${view}/reports/export`) {
        requests.push({ view, type: 'export', params: url.searchParams })
        if (exportOverLimit) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ statusCode: 400, code: 'DashboardExportLimitExceeded', message: 'Too many rows' }) })
        if (slowNextExport) { slowNextExport = false; await new Promise((resolve) => setTimeout(resolve, 500)) }
        return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: '\ufeffId,Event\r\n1,receipt\r\n' })
      }
      if (name === `/api/v1/dashboard/${view}/reports`) {
        requests.push({ view, type: 'report', params: url.searchParams })
        if (slowNextReport) { slowNextReport = false; await new Promise((resolve) => setTimeout(resolve, 500)) }
        if (failNextReport) {
          failNextReport = false
          return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, code: 'InternalServerError', message: 'Hesabat müvəqqəti əlçatan deyil.' }) })
        }
        if (emptyNextReport) {
          emptyNextReport = false
          return json(route, { ...report(view, url.searchParams), metrics: [], orders: [], reservations: [], payments: [], totalRows: 0 })
        }
        return json(route, report(view, url.searchParams))
      }
      if (name === `/api/v1/dashboard/${view}`) return json(route, overview(view, url.searchParams))
      return json(route, {})
    }
    const file = path.join(dist, name === '/' || !path.extname(name) ? 'index.html' : name.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })
  await page.goto(`${origin}/admin`)
  await page.locator('.role-dashboard-metric').first().waitFor()
  return { context, page, errors }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  for (const [roleId, view] of [[1, 'platform'], [2, 'owner'], [3, 'manager']]) {
    const { context, page, errors } = await openPage(browser, roleId, view)
    assert.equal(await page.locator('.role-dashboard-metric').count(), 4)
    await page.screenshot({ path: path.join(dist, `dashboard-overview-${view}-1440.png`), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, `dashboard-overview-${view}-390.png`), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('tab', { name: 'Hesabatlar' }).click()
    await page.locator('.role-dashboard-report-table-scroll tbody tr').first().waitFor()
    assert.equal(await page.locator('.role-dashboard-report-table-scroll tbody tr').count(), 20)
    assert.equal(await page.locator('.role-dashboard-report-metric').count(), view === 'manager' ? 4 : 5)
    assert.equal(await page.getByRole('button', { name: 'Ödənişlər' }).count(), view === 'manager' ? 0 : 1)
    assert.equal(await page.getByText('Təsdiqlənmiş sifariş məbləği').count(), view === 'manager' ? 0 : 1)
    assert.equal(await page.getByRole('group', { name: 'Ödəniş rejimi' }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, `dashboard-reports-${view}-1440.png`), fullPage: true })
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: path.join(dist, `dashboard-reports-${view}-${width}.png`), fullPage: true })
      await page.screenshot({ path: path.join(dist, `dashboard-reports-${view}-${width}-viewport.png`) })
      await page.locator('.role-dashboard-report-table-scroll tbody tr').first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(dist, `dashboard-reports-${view}-${width}-row.png`) })
      await page.evaluate(() => window.scrollTo(0, 0))
    }
    if (view === 'platform') {
      await page.locator('.theme-toggle').click()
      await page.screenshot({ path: path.join(dist, 'dashboard-reports-platform-320-dark.png'), fullPage: true })
      await page.locator('.theme-toggle').click()
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.getByText('#21', { exact: true }).first().waitFor()
    assert.equal(requests.at(-1).params.get('pageIndex'), '2')
    await page.locator('.role-dashboard-report-status-filter select').selectOption('2009')
    await page.getByText('#1', { exact: true }).first().waitFor()
    assert.equal(requests.at(-1).params.get('statusId'), '2009')
    assert.equal(requests.at(-1).params.get('pageIndex'), '1')
    await page.getByRole('button', { name: 'Rezervasiyalar', exact: true }).click()
    await page.locator('.role-dashboard-report-table-scroll tbody tr').first().waitFor()
    assert.equal(await page.locator('.role-dashboard-report-metric').count(), 4)
    assert.equal(requests.at(-1).params.get('kind'), 'reservations')
    assert.equal(requests.at(-1).params.has('statusId'), false)
    if (view === 'manager') {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('.role-dashboard-report-table-scroll tbody tr').first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(dist, 'dashboard-reports-manager-reservations-390.png') })
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    const reportCallsBeforeInvalid = requests.filter((item) => item.type === 'report').length
    await page.getByRole('button', { name: 'Tarix seç' }).click()
    await page.getByLabel('Başlanğıc').fill('2026-01-01')
    await page.getByLabel('Son', { exact: true }).fill('2026-06-01')
    await page.getByText('Tarix aralığı ən çox 92 gün ola bilər.').waitFor()
    assert.equal(requests.filter((item) => item.type === 'report').length, reportCallsBeforeInvalid)
    await page.getByRole('button', { name: '7 gün' }).click()
    await page.locator('.role-dashboard-report-table-scroll tbody tr').first().waitFor()
    if (view !== 'manager') {
      await page.getByRole('button', { name: 'Ödənişlər', exact: true }).click()
      await page.locator('.role-dashboard-report-table-scroll tbody tr').first().waitFor()
      assert.equal(await page.locator('.role-dashboard-report-metric').count(), 5)
      assert.equal(await page.locator('.role-dashboard-report-table-scroll tbody tr').count(), 2)
      assert.equal(await page.getByRole('group', { name: 'Ödəniş rejimi' }).count(), 1)
      assert.equal(requests.at(-1).params.get('kind'), 'payments')
      if (view === 'platform') {
        await page.screenshot({ path: path.join(dist, 'dashboard-reports-platform-payments-1440.png') })
        await page.setViewportSize({ width: 320, height: 844 })
        await page.locator('.role-dashboard-report-table-scroll tbody tr').first().scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(dist, 'dashboard-reports-platform-payments-320.png') })
        await page.setViewportSize({ width: 1440, height: 900 })
      }
      await page.getByRole('button', { name: 'Test', exact: true }).click()
      await page.getByText('Test', { exact: true }).first().waitFor()
      assert.equal(requests.at(-1).params.get('paymentMode'), 'test')
      await page.getByRole('button', { name: 'Geri ödəniş', exact: true }).click()
      assert.equal(requests.at(-1).params.get('paymentEvent'), 'refund')
      exportOverLimit = true
      await page.getByRole('button', { name: 'CSV endir' }).click()
      await page.getByText('5000-dən çox qeyd var. CSV endirmək üçün tarix aralığını və ya restoranı daraldın.').waitFor()
      exportOverLimit = false
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'CSV endir' }).click()
      const file = await download
      assert.match(file.suggestedFilename(), /ecafe-payments.*test\.csv$/)
      assert.equal(requests.at(-1).type, 'export')
      if (view === 'platform') {
        let unexpectedDownloads = 0
        page.on('download', () => { unexpectedDownloads += 1 })
        slowNextExport = true
        await page.getByRole('button', { name: 'CSV endir' }).click()
        await page.waitForFunction(() => document.querySelector('.role-dashboard-report-export')?.textContent?.includes('Hazırlanır'))
        await page.getByRole('button', { name: 'Sifarişlər', exact: true }).click()
        await page.locator('.role-dashboard-report-table-scroll tbody tr').first().waitFor()
        await page.waitForTimeout(650)
        assert.equal(unexpectedDownloads, 0)
      }
    }
    slowNextReport = true
    await page.getByRole('button', { name: 'Yenilə', exact: true }).click()
    assert.equal(await page.locator('.role-dashboard-report-table-scroll tbody tr').count() > 0, true)
    await page.getByText('Yenilənir').waitFor()
    await page.getByText('Yenilənir').waitFor({ state: 'hidden' })
    emptyNextReport = true
    await page.getByRole('button', { name: 'Yenilə', exact: true }).click()
    await page.getByText('Seçilmiş filtrlərə uyğun qeyd yoxdur.').waitFor()
    failNextReport = true
    await page.getByRole('button', { name: 'Yenilə', exact: true }).click()
    await page.getByText('Hesabat müvəqqəti əlçatan deyil.').waitFor()
    await page.getByRole('button', { name: 'Yenilə', exact: true }).click()
    await page.locator('.role-dashboard-report-table-scroll tbody tr').first().waitFor()
    if (view === 'platform') {
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="en"]').click()
      await page.getByRole('heading', { name: 'Reports', exact: true }).waitFor()
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="ru"]').click()
      await page.getByRole('heading', { name: 'Отчёты', exact: true }).waitFor()
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="az"]').click()
    }
    await page.getByRole('tab', { name: 'İcmal' }).click()
    await page.locator('.role-dashboard-metric').first().waitFor()
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('Dashboard report roles, filters, CSV, refresh, and responsive views passed')
} finally {
  await browser.close()
}
