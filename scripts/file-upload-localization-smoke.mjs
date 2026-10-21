import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dist = path.resolve('dist')
const origin = 'http://ecafe.test'
const token = `header.${Buffer.from(JSON.stringify({ userId: '42', name: 'QA', surname: 'Admin', email: 'qa@example.com', roleId: '1', roleName: 'Platform Admin', permissions: [] })).toString('base64url')}.signature`
let uploadCount = 0
let uploadOutcome = 'pending'
let resolveUpload

function json(route, data, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) })
}

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' })
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
      if (pathname === '/api/v1/lookups/roles') return json(route, [{ id: 4, code: 'Waiter', name: 'Ofisiant', isStaffAssignable: true }])
      if (pathname === '/api/v1/file/upload' && request.method() === 'POST') {
        uploadCount += 1
        if (uploadOutcome === 'pending') {
          await new Promise((resolve) => { resolveUpload = resolve })
          return json(route, { id: 37, fileName: 'receipt.png' })
        }
        if (uploadOutcome === 'server') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ statusCode: 400, message: 'Receipt rejected by server' }) })
        return route.abort('failed')
      }
      if (pathname.endsWith('/notifications')) return json(route, { items: [], pageIndex: 1, totalPages: 1, totalCount: 0 })
      if (pathname.endsWith('/unread-count')) return json(route, { count: 0 })
      return json(route, {})
    }
    const file = path.join(dist, pathname === '/' || !path.extname(pathname) ? 'index.html' : pathname.slice(1))
    if (!file.startsWith(dist) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' })
  })

  await page.goto(`${origin}/admin/staff/new?restaurantId=1`)
  const upload = page.locator('.upload-field')
  const input = upload.locator('input[type="file"]')
  await upload.getByText('Fayl seç', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Dil: Azərbaycanca/ }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await upload.getByText('Choose file', { exact: true }).waitFor()

  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(11 * 1024 * 1024) })
  await upload.getByText('The file is too large. Choose a file up to 10 MB.').waitFor()
  assert.equal(uploadCount, 0)
  await page.getByRole('button', { name: /Language: English/ }).click()
  await page.getByRole('button', { name: 'Русский' }).click()
  await upload.getByText('Файл слишком большой. Выберите файл размером не более 10 МБ.').waitFor()
  await upload.getByText('Выбрать файл', { exact: true }).waitFor()

  await input.setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('image') })
  await upload.getByText('Загрузка...', { exact: true }).waitFor()
  assert.equal(uploadCount, 1)
  await page.getByRole('button', { name: /Язык: Русский/ }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await upload.getByText('Uploading...', { exact: true }).waitFor()
  resolveUpload()
  await upload.getByText('File #37', { exact: true }).waitFor()
  await upload.getByText('receipt.png', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Language: English/ }).click()
  await page.getByRole('button', { name: 'Русский' }).click()
  await upload.getByText('Файл №37', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(dist, 'file-upload-desktop.png'), fullPage: true })

  await input.setInputFiles([])
  await upload.getByText('Выбрать файл', { exact: true }).waitFor()
  assert.equal(await upload.getByText('Файл №37', { exact: true }).count(), 0)
  uploadOutcome = 'failed'
  await input.setInputFiles({ name: 'retry.png', mimeType: 'image/png', buffer: Buffer.from('image') })
  await upload.getByText('Не удалось загрузить файл. Попробуйте ещё раз.').waitFor()
  await page.getByRole('button', { name: /Язык: Русский/ }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await upload.getByText('File upload failed. Please try again.').waitFor()

  uploadOutcome = 'server'
  await input.setInputFiles({ name: 'server.png', mimeType: 'image/png', buffer: Buffer.from('image') })
  await upload.getByText('Receipt rejected by server').waitFor()
  await page.getByRole('button', { name: /Language: English/ }).click()
  await page.getByRole('button', { name: 'Русский' }).click()
  await upload.getByText('Receipt rejected by server').waitFor()

  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: path.join(dist, 'file-upload-mobile.png'), fullPage: true })
  assert.equal(uploadCount, 3)
  assert.deepEqual(pageErrors, [])
  console.log('File upload localization smoke passed')
} finally {
  await browser.close()
}
