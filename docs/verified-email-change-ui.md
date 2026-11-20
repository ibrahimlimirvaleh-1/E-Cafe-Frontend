# Verified Email Change UI

Branch: `security/verified-email-change-ui`. Repository changes only; merge, deployment and APK publication are separate operations.

## Contract

- Authenticated `POST /api/v1/profile/email-change/request`: JSON `{newEmail,currentPassword}`, empty 202. Accepted copy is identical for available and already-owned addresses.
- Authenticated `POST /api/v1/profile/email-change/confirm`: JSON `{token}`, empty 204. Server checks the current active session of the requesting account, single-use token and 30-minute expiry, revokes all sessions and clears the refresh cookie. The original device/SID is not required; the account SessionVersion and OriginalEmail must remain unchanged.
- Security POSTs do not refresh and replay on a 401. They present a sign-in-required state.
- Request modal has a 60-second local resend cooldown, retained while the profile page stays mounted. Server rate limits remain authoritative.
- Profile and staff PUTs send the loaded existing email, never an edited form email. Staff creation still accepts an email.

## Token Handling

`/confirm-email-change#token=...` is captured by a dependency loaded before React/auth/localization startup. `history.replaceState` immediately removes the fragment and query. The token lives only in module memory until the page mounts, then component memory. It is never stored in browser storage, router state, URLs, analytics or logs. Confirmation is an explicit button POST, not page-load behavior.

When unauthenticated, the token is discarded. The page tells the user to sign into the account that requested the change and reopen the original email link. A reload after scrubbing also requires reopening that original link. Invalid/expired/wrong-account/session/rate-limit responses discard the token. Network failures allow an explicit retry while the page remains open.

Successful confirmation clears local auth without calling logout again, sets the existing manual-logout marker (preventing cookie bootstrap), and shows a login action. A refresh that was already pending cannot repopulate auth after explicit clearing.

Every token save/clear advances an in-memory auth revision. Pending refreshes are deduplicated only within that revision; stale headers, body parsing, failures and expiry notifications cannot overwrite or clear a later login, even after its manual-logout marker is removed. Old JSON/blob 401 responses also cannot expire the new login. This guards JavaScript auth state; HttpOnly refresh-cookie behavior remains part of server/browser end-to-end verification.

## Localization Handoff

`docs/email-change-ui-messages.json` contains the exact 26 `ui.emailChange.*` keys in AZ/EN/RU for the backend catalogue. The same keys ship in the frontend fallback catalogues. The only placeholder is `{{seconds}}` in `ui.emailChange.retryIn`.

## Verification

Run TypeScript, Vite build, `node scripts/verify-i18n.mjs`, and `node scripts/email-change-security-smoke.mjs` with the configured Playwright module/Chrome. Browser checks intercept all traffic and never contact production services. Screenshots are written under ignored `dist/email-change-*` and `dist/email-confirm-*`.

Verified November 20, 2026: TypeScript and production build passed; 2,367 matching localization keys passed; email smoke passed 20 isolated browser scenarios and produced 33 screenshots at 1440/390/320px in AZ/EN/RU, with light/dark modal checks. Existing file-upload-localization and staff-role-localization smoke tests passed. `git diff --check` passed. Vite reports its existing large-chunk and SignalR annotation warnings.

Follow-up auth-race fix: `node scripts/auth-refresh-race-smoke.mjs` passed 16 deterministic cases using the actual bundled auth/API modules with deferred mock responses. These cover delayed refresh -> explicit clear -> fresh login -> old success/401/403/500/network/body response, per-revision deduplication, stale JSON/blob 401 fallback, and preserved normal refresh/retry/bootstrap/expiry. TypeScript, Vite production build, the 20-scenario email browser smoke and `git diff --check` passed again. No additional UI/translation or live changes.

Local-only built preview: `http://127.0.0.1:5242/account`, confirmation route `http://127.0.0.1:5242/confirm-email-change`. A real end-to-end email delivery/session revocation check still requires the coordinated backend; these checks used mocked 202/204/error responses, not production data.
