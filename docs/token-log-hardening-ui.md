# Token Log Hardening UI

Date: November 24, 2026 (Asia/Baku).
Publication update: the user subsequently authorized committing and pushing this scoped frontend security change. The earlier no-commit statements below describe the implementation/audit phase. No merge, deployment or live server action is authorized or performed here.
Branch: `security/redact-nginx-token-logs-ui`.
Worktree: `C:\Users\mirvaleh.ibrahimli\Documents\Codex\2026-07-20\dem\frontend-token-log-hardening`.
Base: fetched `origin/dev`, `262df2d0c64b5425bcfeeb855c588bcc69631476`.

## Tasks

- [x] Preserve original worktrees and start from the updated merged dev base.
- [x] Redact query/Referer/auth/cookie values from both shipped Nginx configurations without rewriting forwarded requests.
- [x] Handle fragment password links and legacy query links, capture before router/auth initialization, scrub URL and preserve StrictMode state.
- [x] Run real local Nginx, password-link/browser/security regressions, localization, TypeScript and production build checks.
- [x] Document the HTTP error-log tradeoff, backend localization handoff and rollout checks.

No commit, staging, push, deployment, production configuration change or live API test was performed. No real token was copied into code, fixtures, screenshots or this report. All fixtures use clearly synthetic nonsecret values. Earlier worktrees remain unchanged.

## Nginx

Files: `nginx.conf` and `nginx.prod.conf`. Docker already copies the selected `NGINX_CONF` to `/etc/nginx/conf.d/default.conf`; no Dockerfile change is needed.

- `ecafe_safe` is an allowlisted JSON access format: timestamp, method, original path, status, body bytes, request duration and upstream status. Query, raw request line, Referer, User-Agent, Authorization, Cookie and body values are not included. The map strips query from the immutable original request URI, so SPA rewrites do not turn useful paths into `/index.html`. The known `/tracking/...` opaque path is redacted case-insensitively as an extra precaution.
- Server access output remains `/var/log/nginx/access.log`, using only the new format. Existing container stdout collection still works via the image's access-log symlink.
- `error_log /dev/null` at HTTP level intentionally discards request-processing/parser/upstream error text. The shipped Nginx1.27 cannot use the access-log formatter to sanitize its error messages, which may include the original request line and Referer even on malformed requests. Raising its severity alone is not a confidentiality guarantee. Safe access status/upstream-status/timing telemetry remains available; detailed HTTP diagnostic text is lost. Main-level startup/configuration diagnostics remain outside this HTTP override.
- `Referrer-Policy: no-referrer` prevents a legacy token URL from being sent as a subsequent browser Referer. The proxy itself does not rewrite incoming headers, URI, WebSocket query, auth body, mobile refresh/session or push-token payloads. CSP, trusted peer/scheme handling, upgrade headers and timeouts are unchanged.

Before any later rollout, the server-owning chat must inspect the complete effective `nginx -T` configuration for additional raw access/error log sinks, validate `nginx -t`, and run isolated Linux/container checks. Do not add raw debug/error logs to HTTP/server/location scopes. Existing secret-bearing retained logs and other Caddy/API/log-collector configuration need independent handling; a repository fix cannot retroactively remove them. This task did not access the server.

Reference: [Nginx access logging](https://nginx.org/en/docs/http/ngx_http_log_module.html), [Nginx error logging](https://nginx.org/en/docs/ngx_core_module.html#error_log).

## Password Links

- New `/reset-password#token=...` and `/set-password#token=...` links work. Legacy `?token=...` links still work. A single fragment token takes precedence if both sources exist, and both source parameters are removed. Empty/duplicate/overlong/whitespace tokens fail closed; an empty fragment token cannot silently fall back to a query token.
- `src/features/passwordLink/passwordLinkToken.ts` is imported before the router/auth/localization bootstrap. It captures the token in module memory, calls `history.replaceState` while preserving existing history metadata and unrelated URL parameters, and hands a stable state copy to the mounted page. The temporary module copy is discarded on commit. Development StrictMode's double initializer/effect replay and ordinary typing/rerenders retain the intended token after URL scrubbing.
- No token is written to storage, cookie, router state, rendered text, console or a request query. Password operations still require explicit form submit and send the token only in the existing JSON body. API endpoints and auth/session behavior are unchanged. New missing-token feedback and success/fallback messages have AZ/EN/RU keys; set-password failures now use danger feedback.
- A full reload after URL scrubbing intentionally has no token. Reopen the original email link or request a new one; memory-only secrets cannot survive a reload. A legacy query necessarily reaches the first HTTP document request before JavaScript can remove it, which is why ingress log redaction is also required. New fragment links do not send the token in HTTP at all.
- Email-change fragment handling was not modified; its existing22-case suite still passes.

## Verification

- Real local Nginx1.27.5/Windows: **525 cases passed** across both shipped configurations and three proxy-trust modes, including `nginx -t`, mobile auth/refresh/logout, push POST payloads, original query/header forwarding,101 WebSocket upgrades, SPA original paths, synthetic query/Referer/Authorization/Cookie/User-Agent markers,502 upstream failures,400 invalid URI/duplicate Host parsing and retained-log inspections. Windows fixtures use the NUL device instead of Linux `/dev/null`; transport is actual Nginx with isolated loopback mock upstreams, not a config-only assertion. Temporary fixture instances/files were cleaned up.
- `scripts/password-link-security-smoke.mjs`: **47 cases passed** covering both forms, fragment and legacy decoding/precedence, missing/empty/duplicate/long/whitespace/expired links, refresh, exact single POST payload, URL/storage/history/Referer hygiene, AZ/EN/RU and development React.StrictMode.18 screenshots at1440/390/320px in light/dark were generated under ignored `dist`; RU320/dark reset and AZ1440/light setup were visually inspected without overflow.
- Existing regression suites: **283 cases passed** (36 auth races +20 access profiles +46 profile deactivation +22 email-change security +33 tenant boundaries +6 notification action races +51 account deletion +63 announcements/integration +6 announcement StrictMode).
- TypeScript `tsc -b` and Vite production build passed. Existing SignalR PURE-annotation and bundle-size warnings remain.
- i18n:2476 matching nonempty AZ/EN/RU keys/placeholders/plurals passed. `docs/token-log-hardening-ui-messages.json` exactly matches the five new keys per language and is the backend resource handoff; backend synchronization is owned by the backend chat.
- `git diff --check` passed. The index remains empty; ignored `.env.local` was not copied or used. Browser suites mock every HTTP/WebSocket request and do not call production.

## Changed Files

Both Nginx configs; `scripts/nginx-forwarded-proto-smoke.mjs`; new `scripts/password-link-security-smoke.mjs`; `src/main.tsx`; new `src/features/passwordLink/passwordLinkToken.ts`; reset/setup password pages; three catalogs; this report and the five-key localization handoff.13 source/config/test/doc files total. Build output, screenshots, preview logs and dependency junction stay ignored.

Local dev preview is running at `http://127.0.0.1:5244/` (hidden process10016, process-only API proxy override `http://127.0.0.1:8080`, no backend started). Safe mocked static preview `/dist/password-link-reset-password-ru-320-dark.png` returned HTTP200. Interactive backend testing remains separate; all validation above used mock APIs.

## Pre-Push Recheck

On November24 the scoped13 files were reviewed again. TypeScript, Vite build,2476-key i18n validation, the five-key handoff comparison,525 real local Nginx cases,47 password-link cases,36 auth races and22 email-change cases passed again. An initial email smoke run overlapped the build's `dist` rewrite and failed to load its fixture; rerunning against the completed build passed. No application change or test suppression was needed. The earlier283-case full regression result remains applicable to the unchanged production source. No unrelated pending files were found in this worktree. Ignored config/build/screenshots/logs/dependencies remain excluded; push targets only `origin/security/redact-nginx-token-logs-ui`.
