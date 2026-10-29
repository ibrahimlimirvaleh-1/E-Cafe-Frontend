import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const original = '2026-10-30T19:39:00Z'
const offerOriginal = '2026-10-30T19:00:00Z'
const accepted = '2026-10-30T19:55:00Z'
const choice = '2026-10-30T19:20:00Z'
const closing = '2026-10-30T20:00:00Z'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Customer', roleId: '5' })).toString('base64url')}.signature`

function json(route, data, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { data } : data) })
}

function reservation(id, overrides = {}) {
  return {
    id, restaurantId: 1, tableId: 1, tableName: 'Masa-1', restaurantName: 'Test Restaurant',
    reservedAt: id === 96 ? original : offerOriginal,
    noShowDeadlineAt: id === 96 ? closing : '2026-10-30T19:15:00Z', timeZone: 'Asia/Baku',
    peopleCount: 2, status: 'Confirmed', statusId: 1004, workflowFlowCode: '', depositAmount: 0,
    hasConfirmedDeposit: false, canCancelWithRefund: false, tableSessionId: null,
    requiresSessionCloseReview: false, canCompleteSession: false, requiresReceptionReview: false,
    expectedArrivalAt: null, arrivedAt: null, seatedAt: null, mustVacateAt: null,
    reservationArrivalCutoffAt: id === 96 ? '2026-10-30T19:59:00Z' : null,
    ...overrides,
  }
}

function offer(consentToken = 'first') {
  return {
    consentToken, arrivalAt: choice, noShowDeadlineAt: '2026-10-30T19:30:00Z',
    mustVacateAt: closing, decisionExpiresAt: '2026-10-30T19:10:00Z',
    accepted: false, hasDeposit: false, refundAvailable: false, timeZone: 'Asia/Baku',
  }
}

function asset(route, pathname) {
  const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
  if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
  return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
}

async function run(browser, language, width, id) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, reducedMotion: 'reduce' })
  await context.addInitScript((locale) => window.localStorage.setItem('ecafe.language', locale), language)
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date('2026-10-30T19:07:00Z'))
  const errors = []
  const posted = []
  let acceptedArrival = id === 96
  let pendingToken = 'first'
  let optionsReads = 0
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(`${origin}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/v1/')) return asset(route, pathname)
    if (pathname === '/api/v1/user/refresh') return json(route, { accessToken: token })
    if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'QA', surname: 'Customer', roleId: 5, isActive: true })
    if (pathname === '/api/v1/localization/preference') return json(route, { language })
    if (pathname.startsWith('/api/v1/localization/dictionaries/')) return json(route, { language, version: 'v1', fallbackLanguage: 'az', messages: {} })
    if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
    if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
    if (pathname === `/api/v1/public/reservations/${id}`) return json(route, reservation(id, {
      expectedArrivalAt: acceptedArrival ? id === 96 ? accepted : choice : null,
      mustVacateAt: acceptedArrival ? closing : null,
      status: id === 98 ? 'PendingPayment' : 'Confirmed',
      arrivedAt: id === 99 ? '2026-10-30T19:00:00Z' : null,
    }))
    if (pathname === `/api/v1/public/reservations/${id}/history`) return json(route, {
      reservationId: id, items: [
        { id: 1, fromStatus: null, toStatus: 'Confirmed', changedAt: id === 96 ? original : offerOriginal, actorType: 'System', reason: 'Rezervasiya yaradıldı.' },
        ...(acceptedArrival ? [{ id: 2, fromStatus: 'Confirmed', toStatus: 'Confirmed', changedAt: accepted,
          actorType: 'Customer', reason: 'Müştəri yeni gəliş və masanın təhvil şərtlərini qəbul etdi.' }] : []),
      ],
    })
    if (pathname === `/api/v1/public/reservations/${id}/late-arrival`) {
      optionsReads++
      if (id === 103) return json(route, { statusCode: 500, message: 'Temporary failure' }, 500)
      return json(route, {
        canRequest: id === 100 || id === 101 || (id === 105 && optionsReads === 1),
        arrivalChoices: id === 100 || id === 101 || id === 102 || (id === 105 && optionsReads === 1) ? [choice] : [],
        offer: id === 101 ? offer(pendingToken) : null, timeZone: 'Asia/Baku',
      })
    }
    if (pathname === `/api/v1/public/reservations/${id}/late-arrival/offers`) {
      posted.push({ path: pathname, body: JSON.parse(route.request().postData()) })
      if (id === 101) pendingToken = 'refreshed'
      return json(route, offer(pendingToken))
    }
    if (pathname === `/api/v1/public/reservations/${id}/late-arrival/accept`) {
      const body = JSON.parse(route.request().postData())
      posted.push({ path: pathname, body })
      if (body.consentToken === 'first') return json(route, { statusCode: 409, code: 'ArrivalOfferExpired', message: 'Offer is no longer valid.' }, 409)
      acceptedArrival = true
      return json(route, { ...offer(body.consentToken), accepted: true })
    }
    if (pathname === `/api/v1/public/reservations/${id}/refund`) return json(route, null)
    return json(route, {})
  })

  try {
    await page.goto(`${origin}/confirmation?reservationId=${id}`)
    const details = page.locator('.reservation-confirmation-details')
    await details.waitFor()
    if (id === 96) {
      const values = await details.locator('dd').allTextContents()
      assert.ok(values[0].includes('23:55'), `${language}/${width}: accepted arrival not primary`)
      assert.ok(values[1].includes('23:39'), `${language}/${width}: original arrival missing`)
      assert.equal(await details.locator('dt').nth(1).textContent(), {
        az: 'İlkin rezervasiya vaxtı', en: 'Original reservation time', ru: 'Первоначальное время бронирования',
      }[language])
      assert.ok((await details.textContent()).includes('00:00'), `${language}/${width}: midnight departure missing`)
      assert.ok((await details.textContent()).includes('23:59'), `${language}/${width}: reservation cutoff snapshot missing`)
      assert.equal(await page.locator('.reservation-history-item.is-current .reservation-history-current').textContent(), {
        az: 'Son yenilənmə', en: 'Last updated', ru: 'Последнее обновление',
      }[language])
      assert.equal(await page.locator('.reservation-history-item.is-current strong').first().textContent(), {
        az: 'Gəliş vaxtı yeniləndi', en: 'Arrival time updated', ru: 'Время прибытия обновлено',
      }[language])
      assert.equal(await page.locator('.reservation-arrival-unavailable').count(), 0)
      await page.screenshot({ path: path.join(dist, `arrival-accepted-${language}-${width}.png`) })
    }
    if (id === 97) {
      assert.equal(await details.getByText('23:59').count(), 0, 'legacy reservation must not infer a cutoff')
      await page.locator('.reservation-arrival-unavailable').waitFor()
      assert.equal(await page.locator('.reservation-arrival-action button').count(), 0)
    }
    if (id === 98 || id === 99 || id === 102) {
      await page.waitForTimeout(200)
      assert.equal(await page.locator('.reservation-arrival-unavailable').count(), 0)
      assert.equal(await page.locator('.reservation-arrival-action button').count(), 0)
    }
    if (id === 103) {
      await page.locator('.reservation-arrival-action [role="alert"]').waitFor()
      assert.equal(await page.locator('.reservation-arrival-unavailable').count(), 0)
    }
    if (id === 100) {
      await page.locator('.reservation-arrival-action button').waitFor()
      await page.locator('.reservation-arrival-action button').click()
      const dialog = page.getByRole('dialog')
      await dialog.locator('select').waitFor()
      await dialog.locator('select').selectOption(choice)
      await dialog.locator('footer button').click()
      await dialog.getByText('00:00', { exact: false }).first().waitFor()
      const text = await dialog.textContent()
      assert.ok(!/növbəti rezervasiya|next reservation|следующ/i.test(text), `${language}/${width}: next-reservation copy is misleading`)
      assert.ok(text.includes('00:00'), `${language}/${width}: closing time missing`)
      const departure = await dialog.locator('.reservation-arrival-terms dd').last().textContent()
      assert.ok(departure.includes('31') && departure.includes('00:00'), `${language}/${width}: midnight must be the next calendar day`)
      await dialog.screenshot({ path: path.join(dist, `arrival-closing-${language}-${width}.png`) })
      assert.deepEqual(posted[0]?.body, { arrivalAt: choice })
    }
    if (id === 105) {
      await page.locator('.reservation-arrival-action button').waitFor()
      await page.locator('.reservation-arrival-action button').click()
      const dialog = page.getByRole('dialog')
      await dialog.locator('.reservation-arrival-unavailable').waitFor()
      assert.equal(await dialog.locator('select option').count(), 1)
      assert.equal(await dialog.locator('footer button').isDisabled(), true)
      assert.equal(posted.length, 0)
    }
    if (id === 101) {
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await dialog.locator('footer button').filter({ hasText: /Razıyam|I agree|Согласен/ }).click()
      await dialog.getByRole('alert').getByText('Offer is no longer valid.').waitFor()
      const accept = dialog.locator('footer button').filter({ hasText: /Razıyam|I agree|Согласен/ })
      assert.equal(await accept.isDisabled(), true)
      await dialog.locator('footer button').filter({ hasText: /yenidən|Recheck|повторно/i }).click()
      assert.equal(await accept.isDisabled(), false)
      await accept.click()
      await details.locator('dd').first().getByText('23:20').waitFor()
      assert.deepEqual(posted.at(-1)?.body, { consentToken: 'refreshed' })
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${language}/${width}: horizontal overflow`)
    assert.deepEqual(errors, [], `${language}/${width}: page errors`)
  } finally { await context.close() }
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  for (const language of ['az', 'en', 'ru']) {
    for (const width of [320, 390, 1440]) await run(browser, language, width, 96)
    await run(browser, language, 390, 97)
    for (const width of [320, 390, 1440]) await run(browser, language, width, 100)
  }
  for (const id of [98, 99, 101, 102, 103, 105]) await run(browser, 'az', 390, id)
  console.log('Reservation arrival closing-window smoke passed')
} finally { await browser.close() }
