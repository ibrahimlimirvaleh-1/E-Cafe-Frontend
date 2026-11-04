import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const photo = process.env.PROFILE_IMAGE_FILE || path.join(dist, 'ecafe-icon.png')
const errors = []
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, opensAt: '09:00', closesAt: dayOfWeek === 5 ? '03:00' : '00:00', closeDayOffset: 1, isClosed: dayOfWeek === 1, lastReservationArrivalAt: dayOfWeek === 5 ? '01:00' : null, lastReservationArrivalDayOffset: dayOfWeek === 5 ? 1 : null }))

try {
  for (const [language, roleId] of [['az', 5], ['en', null], ['ru', 3]]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'Test', surname: 'User', roleId: String(roleId), restaurantId: roleId === 3 ? '1' : null })).toString('base64url')}.signature`
    let rating = 0
    let hasActiveContract = true
    let restaurantName = 'Dolce Vita Port Baku'
    let phone = '+994559999999'
    await context.addInitScript(({ language }) => localStorage.setItem('ecafe.language', language), { language })
    page.on('pageerror', error => errors.push(error.message))
    await page.route(`${origin}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname
      if (pathname.startsWith('/api/v1/')) {
        if (pathname === '/api/v1/user/refresh') return roleId ? json(route, { accessToken: token }) : route.fulfill({ status: 401, body: '{}' })
        if (pathname === '/api/v1/profile') return json(route, { userId: '42', name: 'Test', surname: 'User', roleId, restaurantId: roleId === 3 ? 1 : null, isActive: true })
        if (pathname === '/api/v1/localization/preference') return json(route, { language })
        if (pathname.includes('/localization/dictionaries/')) return json(route, { language, version: 'v1', fallbackLanguage: 'az', messages: {} })
        if (pathname === '/api/v1/public/restaurants/1') return json(route, { id: 1, name: restaurantName, cuisine: 'Dolce Vita', location: 'Port Baku, 153 Neftchilar Avenue, Nasimi district, Baku, Azerbaijan', phone, rating, ratingAverage: rating, imageUrl: `${origin}/profile-photo.jpg`, timeZone: 'Asia/Baku', workingHours: hours, isOpen: true, hasActiveContract })
        if (pathname === '/api/v1/public/restaurants/1/tables') return json(route, Array.from({ length: 4 }, (_, i) => ({ id: i + 1, tableNo: i + 1, name: `Masa-${i + 1}`, capacity: 2, isEmpty: i !== 3 })))
        if (pathname === '/api/v1/public/restaurants/1/menu') return json(route, [{ id: 1, name: 'Coffee', isActive: true, items: [{ id: 11, name: 'Double espresso', description: 'Freshly roasted coffee', price: 6, isActive: true, imageUrl: `${origin}/profile-photo.jpg` }] }, { id: 2, name: 'Desserts', isActive: true, items: [{ id: 12, name: 'Chocolate cake', price: 12, isActive: true, imageUrl: `${origin}/profile-photo.jpg` }] }])
        if (pathname.endsWith('/notifications')) return json(route, { items: [], totalCount: 0 })
        if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
        return json(route, {})
      }
      if (pathname === '/profile-photo.jpg') return route.fulfill({ contentType: photo.endsWith('.png') ? 'image/png' : 'image/jpeg', body: fs.readFileSync(photo) })
      const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
      if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
      return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream' })
    })
    await page.goto(`${origin}/restaurants/1?reservationDate=2026-11-10`)
    await page.locator('.restaurant-profile-cover img').waitFor()
    await page.waitForFunction(() => document.querySelector('.restaurant-profile-cover img')?.naturalWidth > 0)
    await page.locator('.public-profile-grid .choice-card').first().waitFor()
    assert.equal(await page.locator('.restaurant-profile-rating').count(), 0)
    assert.equal(await page.locator('.restaurant-profile-table-status.is-available').count(), 3)
    assert.equal(await page.locator('.restaurant-profile-navigation button > span').first().innerText(), '4')
    assert.equal(await page.locator('.restaurant-profile-navigation button > span').last().innerText(), '2')
    const booking = page.locator('.restaurant-profile-booking a')
    assert.equal(await booking.count(), roleId === 5 ? 1 : 0)
    if (roleId === 5) assert.match(await booking.getAttribute('href'), /reserve\?reservationDate=2026-11-10$/)

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 740 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.equal(await page.locator('.restaurant-profile-address span').evaluate(node => getComputedStyle(node).whiteSpace), 'nowrap')
      assert.equal(await page.locator('.restaurant-profile-hours').getAttribute('open'), null)
      if (viewport.height >= 740) {
        const section = await page.locator('.public-profile-section').boundingBox()
        assert.ok(section.y < viewport.height, 'The next section should remain visible')
      }
      await page.screenshot({ path: path.join(dist, `restaurant-profile-${language}-${viewport.width}.png`), fullPage: true })
      const photoButton = page.locator('.restaurant-profile-photo-open')
      await photoButton.click()
      const photoDialog = page.getByRole('dialog', { name: 'Dolce Vita Port Baku' })
      await photoDialog.waitFor()
      assert.equal(await photoDialog.evaluate(node => node.matches(':modal')), true)
      assert.equal(await photoDialog.locator('img').evaluate(node => getComputedStyle(node).objectFit), 'contain')
      await page.keyboard.press('Tab')
      assert.equal(await photoDialog.evaluate(node => node.contains(document.activeElement)), true)
      if (viewport.width === 320) await page.screenshot({ path: path.join(dist, `restaurant-photo-${language}-320.png`) })
      await page.keyboard.press('Escape')
      assert.equal(await photoDialog.count(), 0)
      assert.equal(await photoButton.evaluate(node => node === document.activeElement), true)
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await page.locator('.restaurant-profile-hours summary').click()
      assert.equal(await page.locator('.working-hours-day').count(), 7)
      assert.equal(await page.locator('.working-hours-display-profile .working-hours-display-values small').count(), 1)
      const dayWidths = await page.locator('.working-hours-day').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, width: node.clientWidth, scroll: node.scrollWidth, overflow: getComputedStyle(node).textOverflow })))
      assert.ok(dayWidths.every(day => day.scroll <= day.width + 1 && day.overflow !== 'ellipsis'), `${language} ${viewport.width}: ${JSON.stringify(dayWidths)}`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: path.join(dist, `restaurant-profile-hours-${language}-${viewport.width}.png`), fullPage: true })
      await page.locator('.restaurant-profile-hours summary').focus()
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('.restaurant-profile-hours').getAttribute('open'), null)
      await page.evaluate(() => scrollTo(0, 0))
    }
    await page.locator('.restaurant-profile-navigation button').last().click()
    await page.getByText('Double espresso', { exact: true }).waitFor()
    assert.equal(await page.locator('.restaurant-profile-navigation button').last().getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: /Desserts/ }).click()
    await page.getByText('Chocolate cake', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => { localStorage.setItem('ecafe.theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark') })
    await page.screenshot({ path: path.join(dist, `restaurant-profile-menu-dark-${language}.png`), fullPage: true })
    rating = 4.6
    hasActiveContract = false
    await page.reload()
    await page.locator('.restaurant-profile-rating').waitFor()
    assert.match(await page.locator('.restaurant-profile-rating').innerText(), /4.6/)
    await page.locator('.contract-guard-blocked').waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    restaurantName = 'Dolce Vita Port Baku Neftchilar Avenue Private Dining and Restaurant'
    phone = ''
    await page.setViewportSize({ width: 320, height: 740 })
    await page.reload()
    await page.getByRole('heading', { name: restaurantName, exact: true }).waitFor()
    assert.equal(await page.locator('.restaurant-profile-contact a').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const toolbarBox = await page.locator('.restaurant-profile-cover-toolbar').boundingBox()
    const captionBox = await page.locator('.restaurant-profile-cover-caption').boundingBox()
    assert.ok(captionBox.y >= toolbarBox.y + toolbarBox.height, 'Long names must not overlap the cover controls')
    await page.locator('.restaurant-profile-photo-open').click()
    await page.getByRole('dialog', { name: restaurantName }).getByRole('button').click()
    assert.equal(await page.getByRole('dialog').count(), 0)
    await context.close()
  }
  assert.deepEqual(errors, [])
  console.log('Restaurant profile layout smoke passed: AZ/EN/RU, customer/manager/guest, six viewports, hours, menu, dark mode, contract and reservation link')
} finally { await browser.close() }
