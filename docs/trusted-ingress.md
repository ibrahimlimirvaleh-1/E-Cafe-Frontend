# Trusted Caddy Scheme Handoff

Publish for review only. The feature branch and PR may be published; merge,
live deployment, reload, API image, APK, keyring and tenant grant changes
remain outside the frontend review step.

## Contract

The intended chain is client HTTPS -> Caddy TLS termination -> frontend Nginx
HTTP -> API HTTP. `$scheme` at Nginx is therefore `http`, even for genuine client
HTTPS. Do not remove or bypass the backend native-auth HTTPS requirement.

Both `nginx.conf` and `nginx.prod.conf` now derive `X-Forwarded-Proto` as follows:

| Original Nginx socket peer | Incoming value | Forwarded value |
| --- | --- | --- |
| Explicitly allowed Caddy IP | Exactly `https` | `https` |
| Explicitly allowed Caddy IP | Exactly `http` | `http` |
| Any other case | Missing, invalid, uppercase or multi-value | Nginx `$scheme` |
| Any untrusted peer | Any value, including forged `https` | Nginx `$scheme` |

`$realip_remote_addr` retains the original socket peer if a real-IP module rewrites
`$remote_addr`; an attacker-supplied client address is not a Caddy identity.
See [Nginx real-IP variables](https://nginx.org/en/docs/http/ngx_http_realip_module.html#embedded_variables).
The geo allowlist and case-sensitive, anchored map deliberately reject ambiguous
scheme chains. See [geo](https://nginx.org/en/docs/http/ngx_http_geo_module.html#geo)
and [map](https://nginx.org/en/docs/http/ngx_http_map_module.html#map).

Every existing API, health, Swagger and hubs proxy location keeps its routes,
methods, body limits, Host, X-Forwarded-For and WebSocket settings. It emits one
sanitized X-Forwarded-Proto value and drops the alternate `Forwarded` header.
This is a scheme handoff, not a general client-IP or forwarded-host trust policy.

## Deployment Dependencies

1. Obtain separate human approval before publishing or touching the live runtime.
2. Confirm the actual socket IP Caddy uses to reach Nginx. Reserve that IP on a
   controlled ingress network; trust no other network members. Do not use the
   browser IP, a public server IP, a hostname, a whole Docker subnet or `default 1`.
3. Prepare a root-controlled file outside the frontend source/release directory,
   for example `/opt/ecafe/nginx/caddy-trusted-proxies.geo`. Each line contains
   only a verified Caddy IP followed by `1;`. Use exact IPv4 `/32` or IPv6 `/128`
   entries. Do not paste these placeholder lines literally:

   ```nginx
   <reserved-caddy-ipv4>/32 1;
   <reserved-caddy-ipv6>/128 1;
   ```

4. Build a NEW frontend image from the approved source, preserving the chosen
   `NGINX_CONF` argument and existing CSP/settings. The Dockerfile installs an
   empty, fail-closed allowlist; it grants trust to nobody by default.
5. Mount the verified host file read-only as
   `/etc/nginx/caddy-trusted-proxies.geo`. Keep the host file outside the source
   directory erased by the existing deploy job. Verify file existence/type first.
   Keep the frontend port unpublished; do not add a host port for this change.
6. Confirm that Caddy establishes X-Forwarded-Proto from its actual incoming
   connection, rather than blindly preserving a client header. Its standard
   reverse-proxy behavior sanitizes this header, but inspect the actual Caddyfile
   for overrides or broader trusted proxies before release.
   See [Caddy header defaults](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults).
7. Backend owner must independently configure its immediate Nginx socket IP in
   `ForwardedHeaders:KnownProxies` for the actual environment. Keep
   XForwardedFor/XForwardedProto handling before HTTPS redirection/controllers,
   with the single sanitized handoff and ForwardLimit=1. Do not clear trust
   lists or add arbitrary networks to make the guard pass.

A missing allowlist entry safely leaves native HTTPS requests rejected. A changed
Caddy IP requires re-verification; do not widen the range to hide that failure.
Prevent reuse of reserved trusted IPs by unrelated containers. Do not recreate or
upgrade the API, mutate its private release overrides, APK mounts, keyring or
tenant grants while rolling out a frontend-only image.

## Verification

No npm packages or production credentials are required for the transport test:

```sh
NGINX_BINARY=/path/to/nginx node scripts/nginx-forwarded-proto-smoke.mjs
```

The script runs the real Nginx executable on loopback-only ephemeral ports with a
local echo upstream. It tests both full configs, each native auth path, other
proxy paths, empty and exact-IP allowlists, original-peer identity after real-IP
rewriting, missing/invalid/list/duplicate/spoofed headers, HTTP fallback, bodies
and WebSocket 101 upgrades. It writes only isolated temporary files and cleans
up its own listener/processes. Optional `NGINX_TEST_REPORT` writes a JSON receipt.

Prepared local verification uses official Nginx/Windows 1.27.5, matching the 1.27
configuration family. Its downloaded ZIP was checked with the detached signature
and the official nginx.org signing key. This is not a Linux/Alpine image test.
Local Docker Desktop's Linux engine was unavailable; do not claim a Docker build
or Linux runtime result from this workstation.

Before rollout, run `nginx -t` and the test on a Linux Nginx matching the candidate
runtime image. Check the NEW image with the intended read-only mount, DNS,
network membership, original peer IPs and `nginx -T`; source tests do not verify
the live Docker topology. Recheck the actual backend environment's proxy trust.

The `Frontend Nginx Ingress` PR workflow builds both candidate variants, runs
`nginx -t` with the bundled empty file and a read-only test mount, then runs the
loopback suite with the same Alpine Nginx in an isolated container. It does not
access the live server or push an image.

After an approved deployment, verify public HTTPS native login/refresh/logout
with controlled test credentials; HTTP or forged headers from an untrusted path
must not satisfy the backend HTTPS guard. Verify web cookie auth, SignalR,
health and Swagger regression behavior. These authenticated/end-to-end and real
Caddy TLS checks remain release gates, not results of the local echo test.
