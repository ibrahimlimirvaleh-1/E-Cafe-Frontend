import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const requests = []
const contractStatuses = [
  { id: 6001, labels: ['Qaralama', 'Draft', 'Черновик'], tone: 'is-warning' },
  { id: 6002, labels: ['Təsdiq gözləyir', 'Awaiting signature', 'Ожидает подписи'], tone: 'is-warning' },
  { id: 6003, labels: ['Aktiv', 'Active', 'Активен'], tone: '' },
  { id: 6004, labels: ['Bitib', 'Expired', 'Истёк'], tone: 'is-danger' },
  { id: 6005, labels: ['Ləğv edilib', 'Terminated', 'Расторгнут'], tone: 'is-danger' },
  { id: 6006, labels: ['Sahibkar təsdiqlədi', 'Owner approved', 'Одобрено владельцем'], tone: 'is-warning' },
  { id: 6007, labels: ['Planlaşdırılıb', 'Scheduled', 'Запланирован'], tone: 'is-warning' },
  { id: null, noContract: true, labels: ['Mövcud deyil', 'None', 'Нет договора'], tone: null },
  { id: null, labels: ['Status məlum deyil', 'Status unknown', 'Статус неизвестен'], tone: 'is-warning' },
  { id: 6099, labels: ['Status məlum deyil', 'Status unknown', 'Статус неизвестен'], tone: 'is-warning' },
]

async function assertContractStatuses(page, languageIndex) {
  const rows = page.locator('.role-dashboard-table-scroll tbody tr')
  assert.equal(await rows.count(), contractStatuses.length)
  for (const [index, expected] of contractStatuses.entries()) {
    const cell = rows.nth(index).locator('td').last()
    assert.match(await cell.innerText(), new RegExp(expected.labels[languageIndex], 'u'))
    const badge = cell.locator('.role-dashboard-status')
    assert.equal(await badge.count(), expected.tone === null ? 0 : 1)
    if (expected.tone !== null) assert.equal(await badge.getAttribute('class'), `role-dashboard-status${expected.tone ? ` ${expected.tone}` : ''}`)
  }
}

async function assertIntegerChartAxis(page) {
  const labels = await page.locator('.role-dashboard-chart-y-axis span').allTextContents()
  assert.ok(labels.length >= 2)
  assert.ok(labels.every((label) => /^\d+$/.test(label)))
}

async function assertDesktopSidebar(page, view) {
  const shell = page.locator('.admin-shell')
  const sidebar = page.locator('.admin-sidebar')
  const activeLink = sidebar.locator('nav a.active')
  assert.equal(await activeLink.getAttribute('href'), '/admin')
  assert.equal(await activeLink.getAttribute('aria-current'), 'page')
  assert.equal(await sidebar.locator('nav a[href="/admin/localization"]').count(), view === 'platform' ? 1 : 0)
  const expandedWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width)
  await page.getByRole('button', { name: 'Yan paneli yığ' }).click()
  assert.match(await shell.getAttribute('class'), /is-collapsed/)
  assert.equal(await page.getByRole('button', { name: 'Yan paneli genişləndir' }).getAttribute('aria-controls'), 'admin-sidebar')
  assert.equal(await sidebar.locator('nav a[href="/admin"]').getAttribute('title'), 'Dashboard')
  assert.equal(await sidebar.locator('nav a[href="/admin"]').getAttribute('aria-label'), 'Dashboard')
  assert.equal(await sidebar.locator('nav a[href="/admin"] svg').count(), 1)
  assert.ok(await sidebar.evaluate((element) => element.getBoundingClientRect().width) < expandedWidth)
  await page.screenshot({ path: path.join(dist, `role-dashboard-${view}-sidebar-collapsed.png`), fullPage: true })
  if (view === 'platform') {
    await page.locator('.theme-toggle').click()
    await page.screenshot({ path: path.join(dist, 'role-dashboard-platform-dark-sidebar-collapsed.png'), fullPage: true })
    await page.locator('.theme-toggle').click()
  }
  await page.reload()
  await page.locator('.role-dashboard-metric').first().waitFor()
  assert.match(await shell.getAttribute('class'), /is-collapsed/)
  if (view === 'platform') {
    await page.locator('.language-switcher-trigger').click()
    await page.locator('.language-switcher-option[lang="ru"]').click()
    await page.getByRole('heading', { name: 'ECafe в цифрах' }).waitFor()
    assert.equal(await sidebar.locator('nav a[href="/admin"]').getAttribute('title'), 'Панель управления')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.locator('.language-switcher-trigger').click()
    await page.locator('.language-switcher-option[lang="az"]').click()
    await page.getByRole('heading', { name: 'ECafe-nin ümumi mənzərəsi' }).waitFor()
  }
  await page.getByRole('button', { name: 'Yan paneli genişləndir' }).click()
  assert.doesNotMatch(await shell.getAttribute('class'), /is-collapsed/)
  assert.equal(await activeLink.getAttribute('aria-current'), 'page')
}

async function assertMobileSidebar(page, view) {
  const shell = page.locator('.admin-shell')
  const sidebar = page.locator('.admin-sidebar')
  const menu = page.getByRole('button', { name: 'Menyunu aç' })
  const close = page.getByRole('button', { name: 'Menyunu bağla' })
  assert.equal(await menu.getAttribute('aria-controls'), 'admin-sidebar')
  assert.equal(await sidebar.evaluate((element) => element.inert), true)
  await menu.click()
  assert.equal(await sidebar.getAttribute('role'), 'dialog')
  assert.equal(await sidebar.getAttribute('aria-modal'), 'true')
  assert.equal(await page.locator('.admin-workspace').evaluate((element) => element.inert), true)
  assert.match(await shell.getAttribute('class'), /is-drawer-open/)
  assert.equal(await sidebar.evaluate((element) => element.inert), false)
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
  assert.equal(await close.evaluate((element) => document.activeElement === element), true)
  assert.equal(await sidebar.locator('nav a.active').getAttribute('aria-current'), 'page')
  await page.screenshot({ path: path.join(dist, `role-dashboard-${view}-drawer-mobile.png`) })
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await sidebar.locator('nav a').last().evaluate((element) => document.activeElement === element), true)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Menyunu aç')
  assert.equal(await menu.evaluate((element) => document.activeElement === element), true)
  assert.equal(await sidebar.evaluate((element) => element.inert), true)
  assert.equal(await page.locator('.admin-workspace').evaluate((element) => element.inert), false)
  assert.equal(await page.evaluate(() => document.body.style.overflow), '')
  await page.keyboard.press('Tab')
  assert.equal(await sidebar.evaluate((element) => element.contains(document.activeElement)), false)
  await menu.click()
  await page.locator('.admin-sidebar-backdrop').click({ position: { x: 370, y: 160 } })
  assert.doesNotMatch(await shell.getAttribute('class'), /is-drawer-open/)
  await menu.click()
  await sidebar.locator('nav a[href="/admin"]').click()
  assert.doesNotMatch(await shell.getAttribute('class'), /is-drawer-open/)
  await menu.click()
  await close.click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Menyunu aç')
  assert.equal(await menu.evaluate((element) => document.activeElement === element), true)
  if (view === 'platform') {
    await page.locator('.theme-toggle').click()
    await menu.click()
    await page.screenshot({ path: path.join(dist, 'role-dashboard-platform-dark-drawer-mobile.png') })
    await page.keyboard.press('Escape')
    await page.locator('.theme-toggle').click()
  }
  await menu.click()
  await page.setViewportSize({ width: 800, height: 900 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.equal(await sidebar.isVisible(), true)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForFunction(() => !document.querySelector('.admin-shell')?.classList.contains('is-drawer-open'))
  assert.equal(await page.evaluate(() => document.body.style.overflow), '')
  assert.equal(await sidebar.isVisible(), true)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.setViewportSize({ width: 320, height: 720 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.admin-topbar.compact button, .admin-topbar.compact a, .admin-topbar.compact summary')]
    .filter((element) => element.getClientRects().length > 0)
    .every((element) => element.getBoundingClientRect().left >= 0 && element.getBoundingClientRect().right <= innerWidth)), true)
  await page.screenshot({ path: path.join(dist, `role-dashboard-${view}-narrow-mobile.png`) })
  await page.getByRole('button', { name: 'Menyunu aç' }).click()
  assert.equal(await sidebar.isVisible(), true)
  await page.keyboard.press('Escape')
}

function token(roleId, restaurantId) {
  const body = { userId: `user-${roleId}-${restaurantId ?? 'none'}`, name: 'Test', surname: 'User', email: 'test@example.com', roleId: String(roleId), roleName: 'Test', restaurantId, restaurantRoles: restaurantId ? [`${restaurantId}:${roleId}`] : [] }
  return `header.${Buffer.from(JSON.stringify(body)).toString('base64url')}.signature`
}

function dashboard(view, params) {
  const mode = params.get('paymentMode') || 'real'
  const page = Number(params.get('pageIndex') || 1)
  const period = params.get('period') || 'week'
  const quietManager = view === 'manager' && (period === 'week' || period === 'month')
  const metricsByView = {
    platform: { activeRestaurants: 18, activeUsers: 1248, reservationCount: 326, activeContracts: 17 },
    owner: mode === 'test'
      ? { orderAmount: 980, collectedAmount: 900, orderCount: 14, averageOrder: 70 }
      : { orderAmount: 6480, collectedAmount: 6120, orderCount: 84, averageOrder: 77.14 },
    manager: quietManager
      ? { todayReservations: 0, openSessions: 0, kitchenOrders: 0, readyOrders: 0 }
      : { todayReservations: 24, openSessions: 8, kitchenOrders: 11, readyOrders: 4 },
  }
  const chartValues = view === 'owner'
    ? period === 'today' ? [mode === 'test' ? 0.11 : 0.01, 0, 0, 0, 0, 0, 0]
      : period === 'month' ? [1250000, 900000, 0, 0, 0, 0, 0]
        : mode === 'test' ? [100, 120, 90, 150, 170, 180, 170] : [740, 820, 610, 1080, 960, 1220, 1050]
    : view === 'platform' ? period === 'month' ? [1, 3, 5, 7, 11, 0, 0]
      : period === 'today' ? [2, 4, 6, 8, 12, 0, 0]
        : [32, 46, 38, 57, 41, 64, 48]
      : quietManager ? period === 'month' ? [0, 0, 0, 0, 0, 0, 0] : [3, 0, 1, 0, 0, 0, 0]
        : [2, 4, 3, 8, 6, 5, 7]
  const financials = mode === 'test'
    ? { collectedAmount: 900, refundedAmount: 80, netCollectedAmount: 820, depositCollectedAmount: 300, sessionCollectedAmount: 600 }
    : { collectedAmount: 6120, refundedAmount: 120, netCollectedAmount: 6000, depositCollectedAmount: 2120, sessionCollectedAmount: 4000 }
  return {
    view, generatedAtUtc: '2026-10-22T10:00:00Z', from: view === 'manager' && !quietManager ? '2026-10-22' : '2026-10-16', to: '2026-10-22', timeZone: 'Asia/Baku', paymentMode: mode,
    restaurants: [{ id: 1, name: 'Dolce Vita', branchName: 'Port Baku', timeZone: 'Asia/Baku' }, { id: 2, name: 'Buta Baku', branchName: 'Neftçilər', timeZone: 'Asia/Baku' }], hasMoreRestaurants: false,
    metrics: Object.entries(metricsByView[view]).map(([key, value]) => ({ key, value, unit: ['orderAmount', 'collectedAmount', 'averageOrder'].includes(key) ? 'AZN' : 'count', previousValue: view === 'manager' || ['activeRestaurants', 'activeUsers', 'activeContracts'].includes(key) ? null : 10, changePercent: key === 'orderAmount' ? 12.5 : null })),
    financials: view === 'manager' ? null : financials,
    chart: { key: view === 'platform' ? 'reservationCount' : view === 'owner' ? 'orderAmount' : 'orderCount', unit: view === 'owner' ? 'AZN' : 'count', granularity: view === 'manager' && !quietManager ? 'hour' : 'day', points: chartValues.map((value, index) => ({ bucketStartUtc: view === 'manager' && !quietManager ? `2026-10-22T${String(8 + index).padStart(2, '0')}:00:00Z` : `2026-10-${String(16 + index).padStart(2, '0')}T08:00:00Z`, value })) },
    alerts: quietManager ? [] : [{ key: 'lowStock', count: 2, tone: 'warning', restaurantId: 1 }, { key: 'readyOrders', count: 0, tone: 'warning', restaurantId: 1 }],
    branchRows: view === 'manager' ? [] : view === 'platform' ? contractStatuses.map(({ id, noContract }, index) => ({ restaurantId: index + 1, name: `Restaurant ${index + 1}`, branchName: 'Port Baku', isActive: true, reservationCount: 12, orderCount: 15, orderAmount: 700, collectedAmount: 600, refundedAmount: 10, contractId: noContract ? null : index + 1, contractStatusId: id, contractEndsAt: noContract ? null : '2026-11-20T20:00:00Z' })) : [{ restaurantId: page, name: page === 1 ? 'Dolce Vita' : 'Buta Baku', branchName: 'Port Baku', isActive: true, reservationCount: 12, orderCount: 15, orderAmount: 700, collectedAmount: 600, refundedAmount: 10, contractId: 4, contractStatusId: 6003, contractEndsAt: '2026-11-20T20:00:00Z' }],
    sessionRows: view !== 'manager' || quietManager ? [] : [{ sessionId: 10, restaurantId: 1, tableId: 1, tableName: 'Masa-1', waiterName: 'Eldegiz', reservationId: 4, guestCount: 2, openedAt: '2026-10-22T08:00:00Z', orderAmount: 0, remainingAmount: 0, preparingCount: 1, readyCount: 0, hasPendingPayment: false, requiresReview: true }],
    pageIndex: page, pageSize: 10, totalRows: view === 'manager' ? quietManager ? 0 : 1 : 15,
  }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  for (const [roleId, view, restaurantId] of [[1, 'platform', undefined], [2, 'owner', '1'], [3, 'manager', '1'], [3, 'manager', ''], [3, 'manager', 'invalid']]) {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route(`${origin}/**`, async (route) => {
      const url = new URL(route.request().url())
      const name = url.pathname
      if (name.startsWith('/api/v1/')) {
        const reply = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
        if (name === '/api/v1/user/refresh') return reply({ accessToken: token(roleId, restaurantId) })
        if (name === '/api/v1/profile') return reply({ userId: `user-${roleId}-${restaurantId ?? 'none'}`, name: 'Test', surname: 'User', roleId, isActive: true, profiles: restaurantId ? [{ restaurantId, restaurantName: 'Dolce Vita · Port Baku', roleId, roleName: 'Test', isActive: true }] : [] })
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
    const requestCount = requests.length
    await page.goto(`${origin}/admin`)
    if (view === 'manager' && restaurantId !== '1') {
      await page.getByText('Aktiv menecer restoranı tapılmadı.', { exact: true }).waitFor()
      assert.equal(requests.length, requestCount)
      assert.equal(await page.locator('.role-dashboard-metric').count(), 0)
      await page.getByRole('button', { name: 'Tarix seç' }).click()
      await page.getByText('Düzgün başlanğıc və son tarix seçin.', { exact: true }).waitFor()
      assert.equal(requests.length, requestCount)
      assert.deepEqual(errors, [])
      await context.close()
      continue
    }
    await page.locator('.role-dashboard-metric').first().waitFor()
    assert.equal(await page.locator('.role-dashboard-metric').count(), 4)
    assert.equal(await page.locator('.role-dashboard-alerts li').count(), 1)
    assert.equal(await page.locator('.role-dashboard-financials').count(), view === 'manager' ? 0 : 1)
    assert.equal(await page.locator('.role-dashboard-table-scroll tbody tr').count(), view === 'platform' ? contractStatuses.length : 1)
    if (view === 'manager') {
      assert.match(requests.find((item) => item.view === view).search, /restaurantId=1/)
      assert.equal(await page.locator('.role-dashboard-table-scroll tbody td').nth(3).innerText(), '—')
      assert.equal(await page.locator('.role-dashboard-table-scroll tbody td').nth(4).innerText(), '—')
      await page.getByText('Yoxlanmalıdır', { exact: true }).waitFor()
      const countBeforeCustom = requests.length
      await page.getByRole('button', { name: 'Tarix seç' }).click()
      await page.getByText('Düzgün başlanğıc və son tarix seçin.', { exact: true }).waitFor()
      assert.equal(await page.getByText('Aktiv menecer restoranı tapılmadı.', { exact: true }).count(), 0)
      assert.equal(requests.length, countBeforeCustom)
      const from = page.getByLabel('Başlanğıc')
      const to = page.getByLabel('Son', { exact: true })
      await to.fill('2026-10-22')
      assert.equal(requests.length, countBeforeCustom)
      await from.fill('2026-10-23')
      assert.equal(requests.length, countBeforeCustom)
      assert.equal(await page.getByText('Aktiv menecer restoranı tapılmadı.', { exact: true }).count(), 0)
      await from.fill('2026-10-21')
      await page.locator('.role-dashboard-metric').first().waitFor()
      assert.equal(requests.length, countBeforeCustom + 1)
      assert.match(requests.at(-1).search, /period=custom.*from=2026-10-21.*to=2026-10-22/)
      await page.getByRole('button', { name: 'Bu gün' }).click()
      await page.locator('.role-dashboard-metric').first().waitFor()
      assert.match(requests.at(-1).search, /period=today/)
      assert.equal(await page.getByText('Düzgün başlanğıc və son tarix seçin.', { exact: true }).count(), 0)
      await page.getByRole('button', { name: '7 gün' }).click()
      await page.getByText('Hazırda diqqət tələb edən məsələ yoxdur.', { exact: true }).waitFor()
      assert.deepEqual(await page.locator('.role-dashboard-metric strong').allTextContents(), ['0', '0', '0', '0'])
      assert.deepEqual(await page.locator('.role-dashboard-chart-y-axis span').allTextContents(), ['3', '2', '1', '0'])
      assert.equal(await page.locator('.role-dashboard-chart-column').count(), 7)
      assert.equal(await page.locator('.role-dashboard-chart-bar').nth(1).evaluate((element) => element.getBoundingClientRect().height), 0)
      const firstBar = page.locator('.role-dashboard-chart-column').first()
      await page.keyboard.press('Tab')
      await firstBar.focus()
      assert.match(await firstBar.getAttribute('aria-label'), /3/)
      assert.notEqual(await firstBar.evaluate((element) => getComputedStyle(element, '::after').content), 'none')
      await firstBar.evaluate((element) => element.blur())
      assert.equal(await page.locator('.role-dashboard-table-scroll tbody tr').count(), 0)
      await page.getByText('Bu dövr üçün məlumat tapılmadı.', { exact: true }).waitFor()
      await page.screenshot({ path: path.join(dist, 'role-dashboard-manager-low-activity-desktop.png'), fullPage: true })
      await page.setViewportSize({ width: 390, height: 844 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: path.join(dist, 'role-dashboard-manager-low-activity-mobile.png'), fullPage: true })
      await page.setViewportSize({ width: 1365, height: 900 })
      await page.getByRole('button', { name: '30 gün' }).click()
      await page.getByText('Bu dövr üçün diaqram məlumatı yoxdur.', { exact: true }).waitFor()
      assert.equal(await page.locator('.role-dashboard-chart-column').count(), 0)
      await page.getByRole('button', { name: 'Bu gün' }).click()
      await page.locator('.role-dashboard-chart-column').first().waitFor()
    } else await page.getByText('Aktiv', { exact: true }).waitFor()
    if (view === 'platform') {
      await assertContractStatuses(page, 0)
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="en"]').click()
      await page.getByRole('heading', { name: 'ECafe at a glance' }).waitFor()
      await assertContractStatuses(page, 1)
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="ru"]').click()
      await page.getByRole('heading', { name: 'ECafe в цифрах' }).waitFor()
      await assertContractStatuses(page, 2)
      await page.locator('.language-switcher-trigger').click()
      await page.locator('.language-switcher-option[lang="az"]').click()
      await page.getByRole('heading', { name: 'ECafe-nin ümumi mənzərəsi' }).waitFor()
      await assertContractStatuses(page, 0)
      await page.getByRole('button', { name: '30 gün' }).click()
      await page.waitForFunction(() => document.querySelector('.role-dashboard-chart-y-axis span')?.textContent === '12')
      await assertIntegerChartAxis(page)
      await page.getByRole('button', { name: 'Bu gün' }).click()
      await page.waitForFunction(() => document.querySelectorAll('.role-dashboard-chart-column')[4]?.getAttribute('aria-label')?.includes('12'))
      await assertIntegerChartAxis(page)
      await page.getByRole('button', { name: '7 gün' }).click()
      await page.waitForFunction(() => document.querySelector('.role-dashboard-chart-y-axis span')?.textContent === '80')
      await page.locator('.theme-toggle').click()
      await page.screenshot({ path: path.join(dist, 'role-dashboard-platform-dark.png'), fullPage: true })
      await page.locator('.theme-toggle').click()
    }
    await assertDesktopSidebar(page, view)
    await page.screenshot({ path: path.join(dist, `role-dashboard-${view}-desktop.png`), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, `role-dashboard-${view}-mobile.png`), fullPage: true })
    await assertMobileSidebar(page, view)
    await page.setViewportSize({ width: 390, height: 844 })
    if (view === 'owner') {
      assert.match(await page.locator('.role-dashboard-metric strong').first().innerText(), /₼/)
      await page.getByRole('button', { name: 'Test', exact: true }).click()
      await page.getByText('Yalnız test ödənişləri').waitFor()
      assert.match(requests.at(-1).search, /paymentMode=test/)
      await page.getByRole('button', { name: '2', exact: true }).click()
      await page.getByText('Buta Baku', { exact: true }).waitFor()
      assert.match(requests.at(-1).search, /pageIndex=2/)
      await page.getByRole('button', { name: 'Bu gün' }).click()
      await page.waitForFunction(() => document.querySelectorAll('.role-dashboard-chart-y-axis span').length === 5)
      assert.deepEqual(
        (await page.locator('.role-dashboard-chart-y-axis span').allTextContents()).map((label) => Number(label.replace(',', '.'))),
        [0.12, 0.09, 0.06, 0.03, 0],
      )
      await page.getByRole('button', { name: 'Real', exact: true }).click()
      await page.waitForFunction(() => document.querySelectorAll('.role-dashboard-chart-y-axis span').length === 2)
      const tinyLabels = await page.locator('.role-dashboard-chart-y-axis span').allTextContents()
      assert.equal(new Set(tinyLabels).size, tinyLabels.length)
      assert.equal(tinyLabels.length, 2)
      await page.getByRole('button', { name: '30 gün' }).click()
      await page.waitForFunction(() => Number(document.querySelector('.role-dashboard-chart-y-axis span')?.textContent?.replaceAll(/[^\d]/g, '')) >= 1_250_000)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.setViewportSize({ width: 1365, height: 900 })
      await page.screenshot({ path: path.join(dist, 'role-dashboard-owner-large-amount-desktop.png'), fullPage: true })
    }
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('Role dashboard smoke passed')
} finally {
  await browser.close()
}
