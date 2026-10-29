import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', roleId: '5' })).toString('base64url')}.signature`
const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek, opensAt: '09:00:00', closesAt: '00:00:00', closeDayOffset: 1,
  lastReservationArrivalAt: null, lastReservationArrivalDayOffset: null, isClosed: false,
}))
hours[5] = { ...hours[5], closesAt: '02:00:00', lastReservationArrivalAt: '01:00:00', lastReservationArrivalDayOffset: 1 }
hours[6] = { ...hours[6], lastReservationArrivalAt: '23:00:00', lastReservationArrivalDayOffset: 0 }

function json(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
}

function asset(route, pathname) {
  const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
  if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
}

async function run(browser, width, overlap = false) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
  await context.addInitScript(() => window.localStorage.setItem('ecafe.language', 'az'))
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date('2026-10-29T08:00:00Z'))
  const errors = []
  let staleTable = false
  const localHours = hours.map((hour) => ({ ...hour }))
  if (overlap) localHours[6].opensAt = '00:00:00'
  page.on('pageerror', (error) => errors.push(error.message))
  page.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
    if (pathname === '/api/v1/profile') return json(route, { userId: '42', roleId: 5, name: 'QA', surname: 'Customer', isActive: true })
    if (pathname === '/api/v1/localization/preference') return json(route, { language: 'az' })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language: 'az', version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname === '/api/v1/public/restaurants/1') return json(route, { id: 1, name: 'Test Restaurant', timeZone: 'Asia/Baku', workingHours: localHours })
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    if (pathname.endsWith('/tables/availability')) {
      const selected = url.searchParams.get('reservedAt') || ''
      const closed = selected.includes('T23:15:00')
      const allowed = selected.includes('T23:00:00') || selected.includes('T23:10:00')
      if (selected.includes('T23:10:00')) return new Promise((resolve) => setTimeout(() => resolve(json(route, {
        reservedAt: selected, reservationArrivalCutoffAt: '2026-10-31T23:00:00+04:00',
        isReservationArrivalAllowed: true, isRestaurantOpen: true, hasAvailableTable: true,
        availableCount: 1, messageCode: '', tables: [],
      })), 250))
      return json(route, {
        reservedAt: selected, reservationArrivalCutoffAt: '2026-10-31T23:00:00+04:00',
        isReservationArrivalAllowed: allowed && !staleTable, isRestaurantOpen: !closed,
        hasAvailableTable: !closed, availableCount: closed ? 0 : 1, depositAmount: 0,
        messageCode: closed ? 'RestaurantClosed' : allowed && !staleTable ? '' : 'ReservationArrivalCutoffPassed',
        message: closed ? 'Restoran bağlıdır.' : '',
        tables: closed ? [] : [{ id: 1, name: 'Masa-1', tableNo: '1', capacity: 2, status: 'Available', isPublic: true }],
      })
    }
    return json(route, {})
  })
  try {
    await page.goto(`${origin}/restaurants/1/reserve?reservationDate=2026-10-31`)
    const hour = page.getByRole('combobox', { name: 'Saat' })
    const minute = page.getByRole('combobox', { name: 'Dəqiqə' })
    await hour.selectOption('01')
    await minute.selectOption('00')
    await page.locator('.reservation-day-hours').waitFor()
    assert.match(await page.locator('.reservation-day-hours').innerText(), overlap ? /23:00/ : /01:00.*\(\+1\)/)
    await hour.selectOption('23')
    await minute.selectOption('05')
    assert.match(await page.locator('.reservation-day-hours').innerText(), /23:00/)
    await page.locator('button[type="submit"]').click()
    await page.locator('.reservation-availability-message').waitFor()
    assert.match(await page.locator('.reservation-availability-message').innerText(), /23:00/)
    assert.match(page.url(), /\/reserve/)
    await page.screenshot({ path: path.join(dist, `arrival-cutoff-${width}.png`), fullPage: true })
    await minute.selectOption('10')
    await page.locator('button[type="submit"]').click()
    await minute.selectOption('05')
    await page.waitForTimeout(350)
    assert.match(page.url(), /\/reserve/, 'stale response navigated after selection changed')
    assert.equal(await page.locator('.reservation-availability-message').count(), 0)
    await minute.selectOption('15')
    await page.locator('button[type="submit"]').click()
    await page.locator('.reservation-availability-message').waitFor()
    assert.match(await page.locator('.reservation-availability-message').innerText(), /bağlıdır/)
    assert.doesNotMatch(await page.locator('.reservation-availability-message').innerText(), /son rezervasiya gəlişi/i)
    await minute.selectOption('00')
    assert.equal(await page.locator('.reservation-availability-message').count(), 0)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/tables\?/)
    await page.locator('.reservation-table-card').first().click()
    await page.getByRole('dialog').waitFor()
    staleTable = true
    await page.locator('.reservation-preorder-option-primary').click()
    await page.locator('.reservation-availability-message.warning').first().waitFor()
    assert.match(page.url(), /\/tables\?/, 'stale table advanced after cutoff')
    assert.equal(await page.locator('.reservation-table-card').count(), 0)
    await page.goto(`${origin}/restaurants/1/tables?reservedAt=2026-10-31T23%3A05%3A00%2B04%3A00&peopleCount=2`)
    await page.locator('.reservation-availability-message.warning').first().waitFor()
    assert.equal(await page.locator('.reservation-table-card').count(), 0, 'direct URL bypassed cutoff')
    await page.goto(`${origin}/admin/restaurants/1/edit`)
    assert.equal(await page.locator('.schedule-section').count(), 0, 'customer must not see schedule controls')
    assert.equal(errors.length, 0, errors.join('\n'))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px horizontal overflow`)
  } finally { await context.close() }
}

async function runAdmin(browser, roleId, width, language = 'az') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  await context.addInitScript((locale) => window.localStorage.setItem('ecafe.language', locale), language)
  const page = await context.newPage()
  const staffToken = `header.${Buffer.from(JSON.stringify({ userId: '81', roleId: String(roleId), restaurantId: '1', restaurantRoles: `1:${roleId}` })).toString('base64url')}.signature`
  let pending = null
  let posted = null
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.route(`${origin}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: staffToken })
    if (pathname === '/api/v1/profile') return json(route, { userId: '81', roleId, isActive: true, profiles: [{ restaurantId: '1', restaurantName: 'Test Restaurant', roleId, roleName: roleId === 2 ? 'Sahibkar' : 'Menecer', isActive: true }] })
    if (pathname === '/api/v1/localization/preference') return json(route, { language })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language, version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname === '/api/v1/restaurant/getById/1') return json(route, { id: 1, name: 'Test Restaurant', location: 'Baku', phone: '0500000000', timeZone: 'Asia/Baku', workingHours: hours })
    if (pathname === '/api/v1/restaurants/1/schedule-change') {
      if (route.request().method() === 'POST') {
        posted = JSON.parse(route.request().postData())
        pending = { id: 1, token: 'schedule-token', state: 'Pending', reason: posted.reason, timeZone: 'Asia/Baku', workingHours: posted.workingHours, participants: [], canApply: true }
      }
      return json(route, pending)
    }
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    return json(route, {})
  })
  try {
    await page.goto(`${origin}/admin/restaurants/1/edit`)
    const section = page.locator('.schedule-section')
    await section.locator('.working-hours-row').first().waitFor()
    const bulk = section.locator('.working-hours-bulk')
    const rows = section.locator('.working-hours-row')
    const all = bulk.locator('.working-hours-bulk-actions button').nth(0)
    const selected = bulk.locator('.working-hours-bulk-actions button').nth(1)
    assert.equal(await bulk.locator('#working-hours-bulk-title').innerText(), {
      az: 'Saatları günlərə tətbiq et', en: 'Apply hours to days', ru: 'Применить часы к дням',
    }[language])
    assert.equal(await selected.isDisabled(), true, 'empty selection must disable selected apply')
    await rows.nth(6).locator('.working-day-toggle input').uncheck()
    const bulkTimes = bulk.locator('.working-hours-bulk-times input[type="time"]')
    await bulkTimes.nth(0).fill('10:00')
    await bulkTimes.nth(1).fill('22:00')
    await bulk.locator('.working-hours-bulk-times .working-day-next-day input').uncheck()
    await bulk.locator('.working-hours-bulk-cutoff .working-hours-no-cutoff input').uncheck()
    await bulk.locator('.working-hours-bulk-cutoff input[type="time"]').fill('20:00')
    assert.equal(posted, null, 'bulk draft must not post')
    await all.click()
    for (let day = 0; day < 7; day++) {
      const times = rows.nth(day).locator('input[type="time"]')
      assert.equal(await times.nth(0).inputValue(), '10:00')
      assert.equal(await times.nth(1).inputValue(), '22:00')
      if (day === 6) {
        assert.equal(await rows.nth(day).locator('.working-day-toggle input').isChecked(), false, 'bulk must not open closed day')
        assert.equal(await times.nth(0).isDisabled(), true)
        assert.equal(await times.count(), 2, 'closed day must have no cutoff control')
      } else assert.equal(await times.nth(2).inputValue(), '20:00')
    }
    assert.equal(posted, null, 'apply all must not post')
    await bulk.locator('.working-hours-bulk-cutoff input[type="time"]').fill('23:00')
    assert.equal(await all.isDisabled(), true, 'invalid cutoff must block apply')
    assert.equal(await selected.isDisabled(), true)
    assert.equal(await rows.nth(0).locator('.working-hours-cutoff-time input').inputValue(), '20:00')
    await bulk.locator('.working-hours-bulk-cutoff input[type="time"]').fill('21:00')
    await bulkTimes.nth(0).fill('')
    assert.equal(await all.isDisabled(), true, 'empty opening must block apply')
    assert.equal(await rows.nth(0).locator('input[type="time"]').first().inputValue(), '10:00')
    await bulkTimes.nth(0).fill('11:00')
    await bulkTimes.nth(1).fill('')
    assert.equal(await all.isDisabled(), true, 'empty closing must block apply')
    await bulkTimes.nth(1).fill('23:00')
    await bulk.locator('.working-hours-bulk-cutoff input[type="time"]').fill('')
    assert.equal(await all.isDisabled(), true, 'empty cutoff must block apply')
    await bulk.locator('.working-hours-bulk-cutoff input[type="time"]').fill('21:00')
    await bulkTimes.nth(1).fill('08:00')
    assert.equal(await all.isDisabled(), true, 'closing before opening must block apply')
    await bulkTimes.nth(1).fill('23:00')
    await bulk.locator('.working-hours-bulk-day-options label').nth(1).locator('input').check()
    await bulk.locator('.working-hours-bulk-day-options label').nth(3).locator('input').check()
    assert.equal(await selected.isDisabled(), false)
    await selected.click()
    for (let day = 0; day < 7; day++) {
      const changed = day === 1 || day === 3
      const times = rows.nth(day).locator('input[type="time"]')
      assert.equal(await times.nth(0).inputValue(), changed ? '11:00' : '10:00')
      assert.equal(await times.nth(1).inputValue(), changed ? '23:00' : '22:00')
      if (day === 6) assert.equal(await times.count(), 2)
      else assert.equal(await times.nth(2).inputValue(), changed ? '21:00' : '20:00')
    }
    assert.equal(posted, null, 'apply selected must not post')
    const friday = section.locator('.working-hours-row').nth(5)
    await friday.locator('input[type="time"]').nth(0).fill('09:00')
    await friday.locator('input[type="time"]').nth(1).fill('02:00')
    await friday.locator('.working-day-next-day input').first().check()
    await friday.locator('.working-hours-cutoff-time input').fill('01:00')
    await friday.locator('.working-hours-cutoff-controls .working-day-next-day input').check()
    assert.equal(await rows.nth(5).locator('input[type="time"]').nth(0).inputValue(), '09:00', 'manual override must remain possible')
    assert.equal(posted, null, 'manual draft must not post')
    const editor = section.locator('.working-hours-field')
    await editor.scrollIntoViewIfNeeded()
    if (width > 480) await page.addStyleTag({ content: '.admin-topbar { position: static !important; }' })
    await editor.screenshot({ path: path.join(dist, `arrival-cutoff-editor-${roleId}-${width}.png`) })
    await section.locator('textarea').fill('Cutoff test')
    await section.locator('button[type="submit"]').click()
    await section.locator('.working-hours-display').waitFor()
    assert.equal(posted.workingHours[5].lastReservationArrivalAt, '01:00:00')
    assert.equal(posted.workingHours[5].lastReservationArrivalDayOffset, 1)
    assert.equal(posted.workingHours[0].opensAt, '10:00')
    assert.equal(posted.workingHours[1].opensAt, '11:00')
    assert.equal(posted.workingHours[3].opensAt, '11:00')
    assert.equal(posted.workingHours[2].opensAt, '10:00')
    assert.equal(posted.workingHours[6].lastReservationArrivalAt, null)
    assert.equal(posted.workingHours[6].lastReservationArrivalDayOffset, null)
    await page.reload()
    await section.locator('.working-hours-display').waitFor()
    assert.match(await section.locator('.working-hours-display-item').nth(5).innerText(), /01:00\s*\+1/)
    assert.equal(errors.length, 0, errors.join('\n'))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${roleId}/${width}px horizontal overflow`)
    await page.screenshot({ path: path.join(dist, `arrival-cutoff-admin-${roleId}-${width}.png`), fullPage: true })
  } finally { await context.close() }
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined })
try {
  for (const width of [320, 390, 1440]) await run(browser, width)
  await run(browser, 390, true)
  await runAdmin(browser, 2, 320)
  await runAdmin(browser, 2, 390, 'en')
  await runAdmin(browser, 3, 1440, 'ru')
}
finally { await browser.close() }
console.log('Reservation arrival cutoff smoke passed')
