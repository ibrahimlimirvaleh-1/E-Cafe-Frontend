import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'

const binary = process.env.NGINX_BINARY || 'nginx'
const version = spawnSync(binary, ['-V'], { encoding: 'utf8', windowsHide: true })
assert.equal(version.status, 0, `Set NGINX_BINARY to a local nginx executable: ${version.error || version.stderr}`)
assert.match(version.stderr, /--with-http_realip_module/)
const temporaryParent = fs.realpathSync.native(os.tmpdir())
const temporaryRoot = fs.mkdtempSync(path.join(temporaryParent, 'ecafe-nginx-proto-'))
const normalizePath = value => value.replaceAll('\\', '/')
const backend = http.createServer(async (request, response) => {
  if (request.url.startsWith('/api/v1/log-test-failure')) { request.socket.destroy(); return }
  let body = ''
  for await (const chunk of request) body += chunk
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ method: request.method, path: request.url, headers: request.headers, rawHeaders: request.rawHeaders, body }))
})
let upgradedRequest
backend.on('upgrade', (request, socket) => {
  upgradedRequest = { headers: request.headers, path: request.url }
  socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
const backendPort = backend.address().port
const completed = []
let currentProcess
let currentPrefix

function request(port, route, { peer = '127.0.0.1', headers = {}, upgrade = false, jsonResponse = true, expectedStatus = 200, method: requestedMethod, body: requestedBody } = {}) {
  return new Promise((resolve, reject) => {
    const method = requestedMethod || (route.startsWith('/api/v1/mobile/auth/') ? 'POST' : 'GET')
    const body = requestedBody || (method === 'POST' ? '{"refreshToken":"fixture-only-not-a-real-token"}' : '')
    const req = http.request({ hostname: '127.0.0.1', port, localAddress: peer, path: route, method, agent: false,
      headers: { Host: 'ecafe.test', Forwarded: 'for=127.0.0.1;proto=https', ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...headers } }, response => {
      let content = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { content += chunk })
      response.on('end', () => {
        try { assert.equal(response.statusCode, expectedStatus, content); resolve(jsonResponse ? JSON.parse(content) : { body: content, headers: response.headers }) } catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.setTimeout(3000, () => req.destroy(new Error(`Timed out: ${route}`)))
    if (upgrade) req.on('upgrade', (response, socket) => { socket.destroy(); resolve(response.statusCode) })
    req.end(body)
  })
}

function malformedRequest(port, target, extraHeader) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => socket.end(`GET ${target} HTTP/1.1\r\nHost: ecafe.test\r\n${extraHeader}\r\nConnection: close\r\n\r\n`))
    let result = ''
    socket.on('data', data => { result += data }); socket.on('error', reject); socket.on('end', () => resolve(result))
    socket.setTimeout(3000, () => socket.destroy(new Error('Malformed fixture timeout')))
  })
}

async function freePort() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function stop(prefix) {
  if (!currentProcess) return
  if (currentProcess.exitCode === null) {
    spawnSync(binary, ['-p', prefix, '-c', 'nginx-test.conf', '-s', 'quit'], { encoding: 'utf8', windowsHide: true, timeout: 3000 })
    if (currentProcess.exitCode === null) await Promise.race([once(currentProcess, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))])
    if (currentProcess.exitCode === null) { currentProcess.kill(); await once(currentProcess, 'exit') }
  }
  currentProcess = null
}

const trustedFile = fs.readFileSync('nginx-caddy-trusted-proxies.geo', 'utf8')
assert.equal(trustedFile.replace(/#.*$/gm, '').trim(), '', 'The image must ship with no trusted peer IPs')
assert.match(fs.readFileSync('Dockerfile', 'utf8'), /COPY nginx-caddy-trusted-proxies\.geo \/etc\/nginx\/caddy-trusted-proxies\.geo/)

try {
  for (const filename of ['nginx.conf', 'nginx.prod.conf']) {
    const source = fs.readFileSync(filename, 'utf8')
    assert.match(source, /geo \$realip_remote_addr \$ecafe_from_trusted_caddy/)
    const proxies = [...source.matchAll(/proxy_pass /g)].length
    assert.equal([...source.matchAll(/proxy_set_header X-Forwarded-Proto \$ecafe_forwarded_proto;/g)].length, proxies)
    assert.equal([...source.matchAll(/proxy_set_header Forwarded "";/g)].length, proxies)
    assert.doesNotMatch(source, /proxy_set_header X-Forwarded-Proto (?:\$http_x_forwarded_proto|https|\$scheme);/)
    const routes = ['/api/v1/mobile/auth/login', '/api/v1/mobile/auth/refresh', '/api/v1/mobile/auth/logout', '/hubs/user-events/negotiate',
      ...(filename === 'nginx.prod.conf' ? ['/swagger/v1/swagger.json', '/swagger-ui/index.html', '/health/ready'] : [])]

    for (const mode of ['empty-allowlist', 'trusted-caddy', 'rewritten-client-address']) {
      const directory = path.join(temporaryRoot, `${filename}-${mode}`)
      fs.mkdirSync(path.join(directory, 'logs'), { recursive: true })
      fs.mkdirSync(path.join(directory, 'html'))
      fs.mkdirSync(path.join(directory, 'temp'))
      fs.writeFileSync(path.join(directory, 'html', 'index.html'), 'SPA fixture')
      const allowlist = normalizePath(path.join(directory, 'trusted.geo'))
      fs.writeFileSync(allowlist, mode === 'empty-allowlist' ? trustedFile : '127.0.0.1/32 1;\n')
      const port = await freePort()
      const config = source.replace('listen 80;', `listen 127.0.0.1:${port};`)
        .replaceAll('/var/log/nginx/access.log', normalizePath(path.join(directory, 'logs', 'access.log')))
        .replaceAll('/dev/null', process.platform === 'win32' ? 'NUL' : '/dev/null')
        .replace('/etc/nginx/caddy-trusted-proxies.geo', allowlist)
        .replaceAll('http://ecafe-api:8080', `http://127.0.0.1:${backendPort}`)
        .replace('/usr/share/nginx/html', normalizePath(path.join(directory, 'html')))
      // This fixture proves that changing $remote_addr cannot change scheme trust.
      const realIpFixture = mode === 'rewritten-client-address' ? 'set_real_ip_from 127.0.0.1; set_real_ip_from 127.0.0.2; real_ip_header X-Real-IP;' : ''
      fs.writeFileSync(path.join(directory, 'nginx-test.conf'), `worker_processes 1; master_process off; daemon off; pid logs/nginx.pid; error_log logs/error.log;\nevents { worker_connections 128; }\nhttp { access_log off; ${realIpFixture}\n${config}\n}`)
      const prefix = `${normalizePath(directory)}/`
      const syntax = spawnSync(binary, ['-p', prefix, '-c', 'nginx-test.conf', '-t'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
      assert.equal(syntax.status, 0, syntax.stderr)
      currentProcess = spawn(binary, ['-p', prefix, '-c', 'nginx-test.conf'], { stdio: 'ignore', windowsHide: true })
      currentPrefix = prefix
      currentProcess.on('error', error => { console.error(error.message) })
      let ready = false
      for (let attempt = 0; attempt < 80; attempt++) {
        try { await request(port, routes[0]); ready = true; break } catch {
          if (currentProcess.exitCode !== null) break
          await new Promise(resolve => setTimeout(resolve, 25))
        }
      }
      assert.ok(ready, `nginx failed to start: ${fs.readFileSync(path.join(directory, 'logs', 'error.log'), 'utf8')}`)
      const cases = [
        { name: 'trusted-https', headers: { 'X-Forwarded-Proto': 'https' }, https: true },
        { name: 'trusted-http', headers: { 'X-Forwarded-Proto': 'http' } },
        { name: 'missing-scheme', headers: {} },
        { name: 'uppercase', headers: { 'X-Forwarded-Proto': 'HTTPS' } },
        { name: 'unsupported-scheme', headers: { 'X-Forwarded-Proto': 'wss' } },
        { name: 'scheme-parameters', headers: { 'X-Forwarded-Proto': 'https;proto=https' } },
        { name: 'https-first-chain', headers: { 'X-Forwarded-Proto': 'https, http' } },
        { name: 'https-last-chain', headers: { 'X-Forwarded-Proto': 'http, https' } },
        { name: 'duplicate-mixed', headers: { 'X-Forwarded-Proto': ['https', 'http'] } },
        { name: 'duplicate-https', headers: { 'X-Forwarded-Proto': ['https', 'https'] } },
        { name: 'trusted-peer-rewritten', headers: { 'X-Forwarded-Proto': 'https', 'X-Real-IP': '203.0.113.9' }, https: true },
        { name: 'untrusted-spoof', peer: '127.0.0.2', headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '127.0.0.1', 'X-Real-IP': '127.0.0.1', 'X-Forwarded-Ssl': 'on' } },
        { name: 'forwarded-only', headers: { Forwarded: 'for=127.0.0.1;proto=https', 'X-Forwarded-Scheme': 'https' } },
      ]
      for (const route of routes) for (const test of cases) {
        const result = await request(port, route, test)
        const expected = mode !== 'empty-allowlist' && test.https ? 'https' : 'http'
        const label = `${filename} ${mode} ${route} ${test.name}`
        assert.equal(result.headers['x-forwarded-proto'], expected, label)
        assert.equal(result.rawHeaders.filter(value => value.toLowerCase() === 'x-forwarded-proto').length, 1, label)
        assert.equal(result.headers.forwarded, undefined, label)
        assert.equal(result.path, route, label)
        assert.equal(result.method, route.startsWith('/api/v1/mobile/auth/') ? 'POST' : 'GET', label)
        if (result.method === 'POST') assert.equal(JSON.parse(result.body).refreshToken, 'fixture-only-not-a-real-token', label)
        completed.push(label)
      }
      for (const test of [cases[0], cases[9], cases[11]]) {
        const upgrade = await request(port, '/hubs/user-events?fixture=1', { ...test, headers: { ...test.headers, Upgrade: 'websocket', Connection: 'Upgrade' }, upgrade: true })
        assert.equal(upgrade, 101)
        assert.equal(upgradedRequest.path, '/hubs/user-events?fixture=1')
        assert.equal(upgradedRequest.headers.upgrade, 'websocket')
        assert.equal(upgradedRequest.headers['x-forwarded-proto'], mode !== 'empty-allowlist' && test.https ? 'https' : 'http')
        assert.equal(upgradedRequest.headers.forwarded, undefined)
        completed.push(`${filename} ${mode} websocket-upgrade ${test.name}`)
      }
      const marker = 'ECAFE-SYNTHETIC-NONSECRET', authorization = `Bearer ${marker}-AUTH`, cookie = `fixture=${marker}-COOKIE`
      const sensitiveHeaders = { Referer: `https://fixture.test/reset-password?token=${marker}-REFERER`, Authorization: authorization, Cookie: cookie, 'User-Agent': `${marker}-AGENT` }
      for (const route of [`/hubs/user-events?access_token=${marker}-JWT&token=second`, `/hubs/user-events/negotiate?access_token=${marker}-NEGOTIATE`, `/api/v1/mobile/auth/refresh?token=${marker}-QUERY`]) {
        const result = await request(port, route, { headers: sensitiveHeaders })
        assert.equal(result.path, route, 'Logging must not rewrite the forwarded URI')
        assert.equal(result.headers.authorization, authorization); assert.equal(result.headers.cookie, cookie)
        assert.equal(result.headers.referer, sensitiveHeaders.Referer)
        completed.push(`${filename} ${mode} safe-log-query-forwarding`)
      }
      const pushBody = JSON.stringify({ token: `${marker}-PUSH` })
      const push = await request(port, '/api/v1/mobile/push-tokens?token=fixture', { method: 'POST', body: pushBody, headers: sensitiveHeaders })
      assert.equal(push.body, pushBody); assert.equal(push.method, 'POST')
      completed.push(`${filename} ${mode} push-body-unchanged`)
      for (const route of [`/reset-password?token=${marker}-RESET`, `/set-password?token=${marker}-SET`, `/restaurants/1?token=${marker}-SPA`, `/tracking/${marker}-PATH?token=${marker}-QUERY`, `/Tracking/${marker}-PATH`]) {
        const result = await request(port, route, { headers: sensitiveHeaders, jsonResponse: false })
        assert.equal(result.body, 'SPA fixture'); assert.equal(result.headers['referrer-policy'], 'no-referrer')
        completed.push(`${filename} ${mode} safe-log-spa-path`)
      }
      const wsPath = `/hubs/user-events?access_token=${marker}-WS`
      assert.equal(await request(port, wsPath, { headers: { ...sensitiveHeaders, Upgrade: 'websocket', Connection: 'Upgrade' }, upgrade: true }), 101)
      assert.equal(upgradedRequest.path, wsPath); assert.equal(upgradedRequest.headers.authorization, authorization)
      completed.push(`${filename} ${mode} safe-log-websocket`)
      await request(port, `/api/v1/log-test-failure?access_token=${marker}-UPSTREAM`, { headers: sensitiveHeaders, jsonResponse: false, expectedStatus: 502 })
      completed.push(`${filename} ${mode} safe-log-upstream-error`)
      for (const [target, header] of [[`/reset-password?token=${marker}-BADHEADER`, `Host: ${marker}-DUPLICATE`], [`/bad%ZZ?token=${marker}-BADURI`, `Referer: https://fixture.test/?token=${marker}-REFERER`]]) {
        assert.match(await malformedRequest(port, target, header), /^HTTP\/1\.1 400/)
        completed.push(`${filename} ${mode} safe-log-parser-error`)
      }
      await stop(prefix)
      const logs = fs.readdirSync(path.join(directory, 'logs')).filter(name => name.endsWith('.log')).map(name => fs.readFileSync(path.join(directory, 'logs', name), 'utf8'))
      for (const log of logs) assert.ok(!log.includes(marker), 'Synthetic query/header/path secrets must not appear in any retained log')
      const access = fs.readFileSync(path.join(directory, 'logs', 'access.log'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
      assert.ok(access.some(row => row.path === '/reset-password' && row.status === 200), 'Keep original path, not rewritten /index.html')
      assert.ok(access.some(row => row.path === '/api/v1/log-test-failure' && row.status === 502), 'Keep safe upstream failure telemetry')
      assert.ok(access.some(row => row.path === '/hubs/user-events' && row.status === 101), 'Keep safe WebSocket telemetry')
      for (const row of access) {
        assert.deepEqual(Object.keys(row).sort(), ['time', 'method', 'path', 'status', 'bytes', 'duration', 'upstream_status'].sort())
        assert.ok(!row.path.includes('?'))
      }
    }
  }
  console.log(`PASS ${completed.length} real nginx transport/log cases; both configurations pass nginx -t; safe access/error logs, query/header preservation and missing trust fail closed`)
  if (process.env.NGINX_TEST_REPORT) fs.writeFileSync(process.env.NGINX_TEST_REPORT, JSON.stringify({ platform: process.platform, version: version.stderr, cases: completed }, null, 2))
} finally {
  if (currentProcess) await stop(currentPrefix)
  backend.closeAllConnections()
  await new Promise(resolve => backend.close(resolve))
  const resolved = fs.realpathSync(temporaryRoot)
  assert.equal(path.dirname(resolved), fs.realpathSync(temporaryParent))
  assert.ok(path.basename(resolved).startsWith('ecafe-nginx-proto-'))
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
