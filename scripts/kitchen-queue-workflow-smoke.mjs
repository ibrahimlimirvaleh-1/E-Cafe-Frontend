import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Chef', email: 'chef@example.com', roleId: '6', roleName: 'Kitchen', restaurantId: '1', restaurantRoles: ['1:6'] })).toString('base64url')}.signature`
const sentAt = new Date(Date.now() - 90_000).toISOString()
const statuses = new Map(Array.from({ length: 24 }, (_, index) => [index + 1, index < 21 ? 2001 : index === 21 ? 2002 : index === 22 ? 2003 : 2004]))
const requests = []
let nextGetFailure = null
let getDelayStatus = null
let postDelay = false
let finishPost = null
let staleReplica = false
let language = 'az'
let futureReadyTimestamp = false

function order(id, statusId = statuses.get(id)) {
  return {
    id, restaurantId: 1, tableId: id, tableName: `Masa-${id}`, timeZone: 'Asia/Baku', statusId,
    sentToKitchenAt: id === 23 ? 'invalid-date' : sentAt, acceptedAt: statusId >= 2002 ? sentAt : null,
    preparingAt: statusId >= 2003 ? sentAt : null, readyAt: id === 24 ? futureReadyTimestamp ? new Date(Date.now() + 60_000).toISOString() : sentAt : null,
    canAccept: statusId === 2001, canStartPreparing: statusId === 2002, canMarkReady: statusId === 2003,
    items: [{ id, itemId: id, name: `Məhsul ${id}`, quantity: 1 }],
  }
}

function json(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.clock.install({ time: new Date() })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    if (pathname.startsWith('/api/v1/')) {
      if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
      if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Chef', roleId: 6, isActive: true, profiles: [{ restaurantId: 1, restaurantName: 'Test Restaurant', roleId: 6, roleName: 'Kitchen', isActive: true }] })
      if (pathname === '/api/v1/localization/preference') return json(route, { language })
      if (/^\/api\/v1\/localization\/dictionaries\//.test(pathname)) return json(route, { language: pathname.split('/').at(-1), version: 'v1', fallbackLanguage: 'az', messages: {} })
      if (pathname === '/api/v1/restaurants/1/kitchen/orders' && route.request().method() === 'GET') {
        const statusId = url.searchParams.has('statusId') ? Number(url.searchParams.get('statusId')) : null
        const pageNumber = Number(url.searchParams.get('PageNumber'))
        const pageSize = Number(url.searchParams.get('PageSize'))
        requests.push({ statusId, pageNumber, pageSize })
        if (getDelayStatus === statusId) {
          getDelayStatus = null
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
        if (nextGetFailure) {
          const failure = nextGetFailure
          nextGetFailure = null
          if (failure === 'network') return route.abort('failed')
          return route.fulfill({ status: failure, contentType: 'application/json', body: JSON.stringify({ statusCode: failure, message: 'Queue unavailable' }) })
        }
        const staleCreated = staleReplica && statusId === 2001
        const ids = [...statuses.keys()].filter((id) => statusId === null || (staleCreated && id === 1 ? 2001 : statuses.get(id)) === statusId)
        const items = ids.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map((id) => order(id, staleCreated && id === 1 ? 2001 : statuses.get(id)))
        return json(route, { items, pageIndex: pageNumber, totalPages: Math.max(1, Math.ceil(ids.length / pageSize)), totalCount: ids.length, hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber * pageSize < ids.length })
      }
      if (pathname === '/api/v1/restaurants/1/kitchen/orders/1/accept' && route.request().method() === 'POST') {
        if (postDelay) await new Promise((resolve) => { finishPost = resolve })
        statuses.set(1, 2002)
        staleReplica = true
        return json(route, order(1))
      }
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })

  await page.goto(`${origin}/kitchen`)
  const rows = page.locator('.kitchen-queue-row')
  const row = (id) => rows.filter({ has: page.locator('.kitchen-queue-order strong', { hasText: new RegExp(`^#${id}$`) }) })
  const refresh = page.getByRole('button', { name: 'Növbəni yenilə' })
  await page.getByText('24 sifariş').waitFor()
  assert.equal(await rows.count(), 20)
  assert.deepEqual(requests.at(-1), { statusId: null, pageNumber: 1, pageSize: 20 })
  await page.getByRole('button', { name: 'Mətbəxdə gözləyir' }).click()
  await page.getByText('21 sifariş').waitFor()
  assert.equal(await rows.count(), 20)
  await page.getByRole('button', { name: /Növbəti|Next/i }).click()
  await row(21).waitFor()
  assert.deepEqual(requests.at(-1), { statusId: 2001, pageNumber: 2, pageSize: 20 })
  await page.getByRole('button', { name: 'Qəbul edilib' }).click()
  await page.getByText('1 sifariş').waitFor()
  assert.deepEqual(requests.at(-1), { statusId: 2002, pageNumber: 1, pageSize: 20 })
  assert.equal(await rows.count(), 1)
  assert.match(await row(22).locator('.kitchen-queue-state .kitchen-queue-elapsed').innerText(), /Qəbuldan keçən vaxt/)
  getDelayStatus = 2003
  await page.getByRole('button', { name: 'Hazırlanır' }).click()
  await page.getByRole('button', { name: 'Hazırdır' }).click()
  await page.getByText('1 sifariş').waitFor()
  await page.waitForTimeout(400)
  assert.equal(await rows.count(), 1)
  assert.equal(await rows.first().locator('.kitchen-queue-order strong').innerText(), '#24')
  assert.match(await row(24).locator('.kitchen-queue-state .kitchen-queue-elapsed').innerText(), /Hazır gözləyir/)
  futureReadyTimestamp = true
  await refresh.click()
  await row(24).locator('.kitchen-queue-state .kitchen-queue-elapsed').waitFor({ state: 'hidden' })
  assert.equal(await rows.first().locator('.kitchen-queue-state .kitchen-queue-elapsed').count(), 0)
  futureReadyTimestamp = false
  await refresh.click()
  await row(24).locator('.kitchen-queue-state .kitchen-queue-elapsed').waitFor()
  await page.getByRole('button', { name: 'Hazırlanır' }).click()
  await page.getByText('1 sifariş').waitFor()
  assert.match(await row(23).locator('.kitchen-queue-state .kitchen-queue-elapsed').innerText(), /Hazırlanma müddəti/)
  assert.equal(await rows.first().locator('.kitchen-queue-order .kitchen-queue-elapsed').count(), 0)
  await page.getByRole('button', { name: 'Qəbul edilib' }).click()
  await page.getByText('1 sifariş').waitFor()

  nextGetFailure = 'network'
  await refresh.click()
  await page.getByText('Son yüklənən siyahı göstərilir.', { exact: false }).waitFor()
  assert.equal(await rows.count(), 1)
  assert.equal(await rows.first().getByRole('button', { name: 'Hazırlamağa başla' }).isDisabled(), true)
  await refresh.click()
  await page.getByText('Son yüklənən siyahı göstərilir.', { exact: false }).waitFor({ state: 'hidden' })
  assert.equal(await rows.first().getByRole('button', { name: 'Hazırlamağa başla' }).isEnabled(), true)

  nextGetFailure = 503
  await refresh.click()
  await page.getByText('Son yüklənən siyahı göstərilir.', { exact: false }).waitFor()
  assert.equal(await rows.count(), 1)
  await refresh.click()
  await page.getByText('Son yüklənən siyahı göstərilir.', { exact: false }).waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: 'Mətbəxdə gözləyir' }).click()
  await page.getByText('21 sifariş').waitFor()
  postDelay = true
  await row(1).getByRole('button', { name: 'Qəbul et' }).click()
  await page.getByRole('button', { name: 'Qəbul edilib' }).click()
  await page.getByRole('button', { name: 'Mətbəxdə gözləyir' }).click()
  await page.getByText('21 sifariş').waitFor()
  assert.equal(typeof finishPost, 'function')
  finishPost()
  await row(1).waitFor({ state: 'hidden' })
  assert.equal(await row(1).count(), 0)
  assert.equal(await rows.count(), 19)
  await page.getByRole('button', { name: 'Qəbul edilib' }).click()
  await page.getByText('2 sifariş').waitFor()
  assert.equal(await row(1).count(), 1)
  await page.getByRole('button', { name: 'Mətbəxdə gözləyir' }).click()
  await page.getByText('21 sifariş').waitFor()
  assert.equal(await row(1).count(), 0)

  await page.getByRole('button', { name: 'Hamısı' }).click()
  await page.getByText('24 sifariş').waitFor()
  assert.match(await page.locator('.kitchen-queue-last-updated').innerText(), /Son yenilənmə/)
  const elapsedBefore = await page.locator('.kitchen-queue-elapsed').first().innerText()
  assert.match(elapsedBefore, /Növbədə|Gözləmə/)
  await page.clock.fastForward(65_000)
  assert.notEqual(await page.locator('.kitchen-queue-elapsed').first().innerText(), elapsedBefore)
  await page.screenshot({ path: path.join(dist, 'kitchen-queue-desktop.png'), fullPage: true })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: path.join(dist, `kitchen-queue-${width}.png`), fullPage: true })
  }

  nextGetFailure = 403
  await refresh.click()
  await page.getByText('Növbə yüklənmədi:', { exact: false }).waitFor()
  assert.equal(await rows.count(), 0)
  await refresh.click()
  await page.getByText('24 sifariş').waitFor()
  nextGetFailure = 404
  await refresh.click()
  await page.getByText('Növbə yüklənmədi:', { exact: false }).waitFor()
  assert.equal(await rows.count(), 0)
  for (const nextLanguage of ['en', 'ru']) {
    language = nextLanguage
    await page.evaluate((value) => localStorage.setItem('ecafe.language', value), nextLanguage)
    await page.reload()
    await rows.first().waitFor()
    await page.getByRole('button', { name: nextLanguage === 'en' ? 'All' : 'Все' }).waitFor()
    const labels = nextLanguage === 'en'
      ? [{ filter: 'Accepted', id: 22, elapsed: 'Time since acceptance' }, { filter: 'Preparing', id: 23, elapsed: 'Preparation time' }, { filter: 'Ready', id: 24, elapsed: 'Waiting to be served' }]
      : [{ filter: 'Принят', id: 22, elapsed: 'Время после принятия' }, { filter: 'Готовится', id: 23, elapsed: 'Время приготовления' }, { filter: 'Готов', id: 24, elapsed: 'Ожидает подачи' }]
    for (const item of labels) {
      await page.getByRole('button', { name: item.filter, exact: true }).click()
      await row(item.id).waitFor()
      assert.match(await row(item.id).locator('.kitchen-queue-state .kitchen-queue-elapsed').innerText(), new RegExp(item.elapsed))
    }
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: path.join(dist, `kitchen-queue-${nextLanguage}-${width}.png`) })
    }
  }
  assert.deepEqual(pageErrors, [])
  console.log('Kitchen queue workflow smoke passed')
} finally {
  await browser.close()
}
