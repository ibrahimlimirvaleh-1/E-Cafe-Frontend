import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { build } = createRequire(import.meta.url)('esbuild')
const requests = []
let value
globalThis.__notificationHttp = async (url, init) => { requests.push({ url, init }); return { data: value } }
const bundle = await build({ entryPoints: ['src/shared/api/ecafeApi.ts'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'notification-http-fixture', setup(builder) {
  builder.onResolve({ filter: /\/httpClient$/ }, () => ({ path: 'http', namespace: 'fixture' }))
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export class ApiError extends Error{};export const httpClient=(...args)=>globalThis.__notificationHttp(...args);export const fetchProtectedBlob=()=>{};export const getApiOrigin=()=>"";' }))
} }] })
const { ecafeApi } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const row = id => ({ id, title: 'Fixture', message: 'Body', isRead: false, createdAt: '2026-11-25T12:00:00Z' })
const page = (index = 1, rows = [row(3), row(2), row(1)]) => ({ items: rows, pageIndex: index, totalPages: 3, totalCount: 43, hasPreviousPage: index > 1, hasNextPage: index < 3 })
let cases = 0
for (const [query, expected] of [[undefined, [1, 20]], [{ pageNumber: 2, pageSize: 10 }, [2, 10]], [{ pageNumber: -1, pageSize: -1 }, [1, 20]], [{ pageNumber: 1.5, pageSize: 1000 }, [1, 100]], [{ pageNumber: 3, pageSize: 50.5 }, [3, 20]], [{ pageSize: 6 }, [1, 6]]]) {
  value = page(expected[0]); const controller = new AbortController()
  const result = await ecafeApi.notifications.page(query, controller.signal), request = requests.at(-1), url = new URL(request.url, 'http://fixture.test')
  assert.equal(url.pathname, '/notifications/paged'); assert.equal(Number(url.searchParams.get('PageNumber')), expected[0]); assert.equal(Number(url.searchParams.get('PageSize')), expected[1])
  assert.equal(request.init.signal, controller.signal); assert.deepEqual(result.items.map(r => r.id), ['3', '2', '1']); assert.equal(result.totalCount, 43)
  cases += 1
}
value = page(1, [row(3), row(3), row(2)])
assert.deepEqual((await ecafeApi.notifications.page()).items.map(r => r.id), ['3', '2']); cases += 1
for (const bad of [[], null, {}, { ...page(), items: null }, { ...page(), pageIndex: 2 }, { ...page(), totalCount: -1 }, { ...page(), hasNextPage: 'true' }, { ...page(), items: Array.from({ length: 21 }, (_, i) => row(i + 1)) }, { ...page(), items: [{}] }]) {
  value = bad; await assert.rejects(ecafeApi.notifications.page()); cases += 1
}
value = { items: [], pageIndex: 1, totalPages: 0, totalCount: 0, hasNextPage: false, hasPreviousPage: false }
assert.equal((await ecafeApi.notifications.page()).totalCount, 0); cases += 1
value = [row(1)]; assert.equal((await ecafeApi.notifications.list())[0].id, '1'); assert.equal(requests.at(-1).url, '/notifications'); cases += 1
value = { count: 99 }; const controller = new AbortController(); assert.equal(await ecafeApi.notifications.unreadCount(controller.signal), 99); assert.equal(requests.at(-1).init.signal, controller.signal); cases += 1
console.log(`PASS ${cases} notification pagination API cases: defaults/clamps, abort signal, mapping/dedup, strict metadata, empty page, independent unread count and legacy array compatibility`)
