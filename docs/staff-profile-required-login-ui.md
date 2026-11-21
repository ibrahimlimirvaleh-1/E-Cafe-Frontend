# Staff Profile Required For Login

Verified November 22, 2026 (Asia/Baku).
Branch: `fix/staff-profile-required-login-ui`, based on frontend `origin/dev` at `1babe8c`.
This supersedes the last-profile Customer fallback in `restaurant-profile-deactivation-ui.md`.

## Contract

- Stored staff roles 2/3/4/6 require at least one active staff profile. Deactivating the last one terminates the session and prevents login/refresh. The UI never converts this account to Customer.
- Genuine stored Customer5 and SuperAdmin1 accounts do not require staff profiles. Another remaining active staff profile preserves access and unaffected restaurant scope.
- Backend canonical DB state, not JWT role claims, controls authorization. `StaffProfileInactive` / numeric or string `1141`, normally HTTP401, is terminal; HTTP403 compatibility is also handled. Backend keeps `User.IsActive=true`, increments SessionVersion and revokes refresh tokens on last-profile deactivation. Reactivation does not revive old tokens: fresh credential login is required.
- `RestaurantAccessChanged` reason `staff_access_revoked` triggers authoritative GET/profile verification. A delayed event cannot blindly log out a newer healthy session. Partial changes retain `staff_activated` / `staff_deactivated` behavior.
- Legacy HTTP200 profile responses with staff role and no active staff profile fail closed. A legacy Customer JWT cannot bypass backend DB authorization.
- Global account blocking, genuine session expiration, password reset and logout-all remain terminal independently of profile status.

## Frontend Behavior

`httpClient.ts` recognizes staff denial before automatic refresh/replay, for JSON and protected blobs. Refresh bootstrap retains the typed denial and localized reason instead of reporting a connectivity error. Auth revision checks apply after asynchronous body reads as well as responses.

Login/register are explicitly marked authentication attempts: a denied login to another staff account does not expire an unrelated healthy Customer session. Protected email-change request/confirm still expire the current session on staff denial, even though ordinary security errors suppress the global session event. No security operation is replayed.

Profile reconciliation retains session epochs, request sequence and profile-selection intent guards. Focus, visibility, scheduled checks and reconnect recover missed revocation events. Reconnecting also checks the profile when the hub cannot renegotiate with a revoked token. Other active profiles and unaffected page state remain intact.

The login form displays one inline persistent localized reason, with no floating notice obscuring mobile controls. Double submission is ignored; unmounted, superseded or old-session login responses cannot overwrite a newer session.

## Localization

`staff-profile-required-login-ui-messages.json` contains one new key (`ui.staffAccess.inactive`) and two updated profile-status messages in AZ/EN/RU. The two updates also appear in the historical 18-key profile handoff. Backend owner confirmed matching catalogue integration. The final catalogue verification has 2,386 matching nonempty keys with matching placeholders.

## Verification

All browser HTTP and SignalR/WebSocket transport used intercepted mock fixtures, not production services.

- TypeScript build and Vite production build passed. Existing SignalR annotation and bundle-size warnings remain.
- `profile-deactivation-smoke.mjs`: 46 browser scenarios. Includes two restaurants/two browsers, partial/final deactivation, real Customer/Admin credentials with empty profiles, failed staff login isolation, legacy Customer JWT, reactivation/old token refusal, lost events/focus/poll/reconnect, delayed login/denial races, contract/role refetch, genuine global blocks/logout-all, localized 409 and create/edit status payloads.
- `auth-refresh-race-smoke.mjs`: 36 deterministic cases, including the original 16 refresh races, JSON/blob 401/403/name/1141, stale response/body guards, bootstrap reason and login isolation.
- `access-profiles-smoke.mjs`: 20 rules, including all four staff roles with empty active profiles, true Customer/Admin exceptions, stale admin demotion, per-tab headers and permissions.
- `email-change-security-smoke.mjs`: 22 scenarios, including protected request401/confirm403 terminal staff denial, no refresh replay and no email token leaks; previous 20 security/localization cases retained.
- Existing file-upload localization and staff-role localization smoke tests passed.
- AZ/EN/RU screenshots cover 1440/390/320px in light/dark. Inspected AZ1440/light and RU320/dark: inline reason is visible, controls do not overlap, and horizontal overflow assertions pass.
- `git diff --check` passed; index remains empty.

## Scope And Preview

Changes are local and uncommitted. No push, merge, deploy, APK publication, live API calls or production data changes were performed. The pre-existing ignored `.env.local` production proxy was left untouched and was not used for testing. This is mocked frontend verification, not live backend end-to-end certification.

Existing preview serves safe static QA images:

- `http://127.0.0.1:5242/staff-required-login-az-1440-light.png`
- `http://127.0.0.1:5242/staff-required-login-ru-320-dark.png`

Avoid interactive routes on that preview without a matching local backend configuration. Deploying the new backend contract and frontend together changes staff session eligibility; ordinary customer reservation/payment behavior is outside this change.
