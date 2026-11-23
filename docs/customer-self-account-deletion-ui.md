# Customer Self Account Deletion UI

Integration update: this historical pre-integration report is superseded by `customer-account-announcements-integration.md`. Both features are now combined on `feat/customer-account-announcements-ui`; the separate source commit is preserved.

Branch: `feat/customer-self-account-deletion-ui`, based on frontend `origin/dev` at `f484d92`.
Started November 23, 2026 (Asia/Baku). Local implementation only; no commit/push/merge/deploy/APK or live data changes.

## Tasks

- [x] Add customer-only profile security entry, excluding active staff profiles.
- [x] Integrate advisory GET/profile/account-deletion and password/confirmation POST with fail-closed blockers, 409 reload and safe errors.
- [x] Clear only the initiating session after confirmed success, show a localized login reason, preserve auth epoch/scope guards and secret hygiene.
- [x] Verify mocked role/blocker/error/race scenarios, desktop/mobile/light/dark screenshots, localization and existing auth/security regressions.

Do not use the pre-existing ignored production proxy `.env.local` for validation. Server authorization/transaction rechecks are mandatory; preflight is advisory. Identity anonymization and session revocation do not erase financial/order history.

## Flow And Contract

- The existing profile security panel offers the action only when both the authoritative profile and current user are Customer5 and neither profile list contains an active Owner/Manager/Waiter/Kitchen membership. Inactive staff memberships do not prevent access. Employees, platform admins and legacy Customer JWTs for stored staff accounts do not receive this UI or a preflight request.
- Explicit opening performs strict `GET /profile/account-deletion`. Missing/malformed eligibility, unknown blockers and inconsistent `canDelete=true` with nonempty blockers fail closed. Eight supplied blockers have human-readable AZ/EN/RU messages. Preflight grants no deletion authority.
- The native modal identifies the current email, explains irreversible access closure/profile anonymization and retained order/financial history, then requires current password and a separate acknowledgement checkbox. No promise of complete historical-data erasure is made.
- `POST /profile/account-deletion` sends only `{currentPassword, confirm:true}`, never a user ID. Only HTTP204 completes the operation. Password is removed from form state immediately; POST never automatically refreshes/replays. Invalid credentials do not masquerade as global session expiry. 1142/403 disables the action; 1143/409 reloads eligibility and requires fresh password/consent. Network/unknown outcomes do not claim confirmed success.
- Submit has a synchronous operation lock, active owner/session-epoch check and profile-bound AbortSignal. Closing during a pending POST is prevented; unmount/owner change cancels the client wait. Distinct owner objects prevent stale A-B-A callbacks. A delayed response may not clear or navigate a newer login. Normal token rotation does not invalidate the stable session epoch.
- Confirmed204 clears the initiating in-memory/legacy auth, invalidates outstanding session/profile work, marks manual logout and navigates to login with one inline localized success reason. Server token revocation/refresh-cookie cleanup remains backend responsibility. No extra logout API is called.
- Backend may broadcast `UserDeactivated` before204. Its known `account.customerDeletion.completed` text in any supported language maps to the localized success notice, not a failed operation. Aborted/stale POST continuations are ignored after that event or a newer login. Genuine unrelated deactivation/session failures keep existing behavior.
- The client retains a 60-second retry cooldown across dialog reopening after POST429/temporary lockout. This is a UI throttle, not the server unlock time: backend POST policy is three requests per 15 minutes per user and GET uses PublicRead limits. Server policy remains authoritative after reload/new attempts.

## Verification

Verified November 23, 2026. Every browser HTTP/WebSocket request used mocks; SignalR client code runs against an intercepted transport. No real account deletion or live backend end-to-end claim.

- Repository build commands (`tsc -b` then `vite build`, invoked through their local Node entry points) passed. Existing SignalR annotation and bundle-size warnings remain.
- `scripts/customer-account-deletion-smoke.mjs`: 51 scenarios covering ordinary Customer/no staff; all five noncustomer roles; four active-staff roles on Customer; legacy Customer JWT; inactive membership; all eight blockers and recovery; malformed/inconsistent/unknown eligibility; GET403/500/network; wrong password400/401; POST lockout/rate/customer-only/500/network; retry with fresh credentials; numeric/name1142/1143; POST409 reload/recovery; invalid success200; stale preflight after reopening; explicit confirmation/DOM submit guard; single POST/double-submit; nondismissible pending operation; successful local logout; early realtime/new-login races; stale protected profile and refresh responses; no password in URL/storage/history/console.
- Existing regression suites passed: 46 profile/login browser scenarios, 22 email-security scenarios, 36 deterministic auth races, 20 access-profile rules, 33 tenant-boundary browser scenarios and six non-remounting notification action races. Together with the new51, 214 named scenarios passed.
- Existing file-upload localization and staff-role localization smokes passed. i18n verification: 2,422 matching nonempty AZ/EN/RU keys and matching placeholders/plurals.
- 39 screenshots: ready and blocked states in AZ/EN/RU at1440/390/320px, light/dark, plus three320px dark login-success states. Dialog/document overflow assertions pass. RU320/dark ready and AZ1440/light blocked images were visually inspected.
- `git diff --check` passed. Index remains empty. Only this task's 13 source/test/document files are dirty/untracked; previous work is retained in the merged `f484d92` base and sibling worktrees were untouched.

## Localization And Preview

`docs/customer-self-account-deletion-ui-messages.json` contains 29 UI keys. Structured comparison confirmed exact AZ/EN/RU equality with the backend `customer-account-deletion-ui.server.json`; the completed message also matches `customer-account-deletion.server.json`'s existing realtime key. No additional copy update is pending.

Screenshot examples under this worktree:

- `dist/account-deletion-ready-ru-320-dark.png`
- `dist/account-deletion-blocked-az-1440-light.png`
- `dist/account-deletion-completed-en-320-dark.png`

A hidden local Vite preview serves the current build on `http://127.0.0.1:5242/`. Its child-process-only proxy override targets `http://127.0.0.1:8080`; the ignored `.env.local` production proxy was not edited. Safe static QA link, verified HTTP200: `http://127.0.0.1:5242/account-deletion-ready-ru-320-dark.png`. Interactive integration still requires a matching isolated local backend; validation here used only mocks. Preview logs and all generated images remain ignored.

## Files And Remaining Risk

Changed: `ProfilePage.tsx`, `AuthPage.tsx`, shared profile API/endpoints, `AuthContext.tsx`, the new account-deletion feature/CSS, three catalogues, one focused browser script and these two handoff/report documents. No commit/push/merge/deploy/APK or live data operation was performed.

Authorization, password lockout, transaction-time blocker rechecks, session/version revocation, identity anonymization and retained financial/report references must remain enforced by backend. Cancelling a client request cannot undo an already committed deletion, and a lost response cannot prove it failed; the UI deliberately reports an unconfirmed outcome rather than promising the account remains open. A matching backend rollout and real isolated integration verification are separate work.
