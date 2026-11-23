# Role Targeted Announcements UI

Branch `feat/role-targeted-announcements-ui`, base `origin/dev` at `f484d92`.
Separate worktree: `frontend-role-announcements`. The thirteen uncommitted customer-account-deletion files remain untouched in `frontend-inventory-layout`; neither stash nor temporary commit was used. No production `.env.local` was copied.

## Tasks

- [x] Strict scoped API/destination validation and verified-profile readiness.
- [x] Automatic nonmodal panel, one visible card/max3, explicit single-card receipts, sensitive-flow deferral and session/scope guards.
- [x] Platform-admin draft/translations/audience/expiry/preview/version/publish management.
- [x] Mocked role/receipt/deferral/race/admin regressions, localization, build and responsive visual QA.

No commit/push/merge/deploy/APK or real API mutation. Account deletion and SQL changes are outside this worktree. CustomerProfile CTA only navigates to profile; it never deletes an account. The seeded example remains a server draft until an administrator intentionally publishes a verified release.

## Implementation

- `AnnouncementPanel` is mounted once beside the router, rendered as a nonmodal region. No backdrop, focus trap, autofocus, automatic timeout or polling. It waits for authoritative profile verification, and defers presentation around dialogs, profile chooser/popovers, hidden tabs, dirty forms and sensitive routes.
- Pending GET runs once per stable authenticated scope/language. Response audience must match the actual active-profile headers, including selected roles different from the global JWT role. Unknown schema/destinations fail closed.
- Only the visible card is acknowledged. Next advances one card; X/Open close the batch without acknowledging unseen cards. CTA navigation follows an explicit successful 204 receipt. GET/receipt failures quietly suppress the feature for this login without changing the session.
- Request owners, abort controllers, live auth epoch/profile checks and route/visibility checks protect A-B-A transitions, delayed errors, and old operations unlocking a newer profile. StrictMode cleanup retries an aborted unsettled GET; completed queries do not repeat.
- Closed destinations map to existing routes. Reports uses `/admin?view=reports` plus optional restaurant context. Fresh location intent reopens Reports even after selecting Overview on the same URL. Subsequent profile changes retain the existing dashboard reset behavior.
- Platform-admin-only `/admin/announcements` manages draft audience, AZ/EN/RU content, optional UTC expiry and escaped preview. Published content is readonly until unpublished. Unsaved edits cannot be published. Version conflicts preserve the local draft until explicit reload.
- DTO validation accepts `updatedAtUtc: null` for seeded/new drafts, empty draft translations, and complete published translations (title120/body600). Cursor paging, 409 recovery, closed capability sets and API error localization follow the backend contract.
- HTTP `sessionEffects: 'none'` is opt-in for this feature; its requests also skip refresh and suppress auth-expired events. Existing default session behavior remains unchanged.

## Verification

All browser HTTP and WebSocket traffic was mocked. No production proxy file was copied or changed.

| Check | Result |
| --- | --- |
| `scripts/announcements-smoke.mjs` | 58 scenarios passed, including roles1-6, selected header/global role mismatch, profile verification/chooser, modal/form/visibility deferral, receipts, cross-device seen, version republish and report CTA repeat/default/profile-reset |
| `scripts/announcement-strict-smoke.mjs` | 6 development React.StrictMode scenarios passed: setup-cleanup-setup, pending owner, ABA, route, visibility and new-login races |
| Existing auth/access/deactivation/email/tenant/notification smoke suites | 163 scenarios passed (36+20+46+22+33+6) |
| `scripts/dashboard-reports-smoke.mjs` | Platform/owner/manager report filters, CSV, refresh and responsive views passed; owner mock now supplies a real active profile, without weakening application guards |
| Preserved account-deletion worktree's smoke suite | 51 scenarios passed separately; this is not a combined-feature integration test |
| TypeScript `tsc -b` | Passed |
| Vite production build | Passed; existing SignalR PURE-annotation and large-bundle warnings remain |
| i18n verification | 2442 matching nonempty AZ/EN/RU keys and placeholders passed |
| Backend translation comparison | All49 announcement keys match all3 languages in `product-announcements-ui.server.json` |
| `git diff --check` | Passed; index remains empty |

36 announcement screenshots are in ignored `dist/`: panel/admin, AZ/EN/RU, 320/390/1440px, light/dark. Tests assert no horizontal document overflow. Representative final screenshots were visually inspected:

- `dist/announcement-az-1440-light.png`
- `dist/announcement-ru-320-dark.png`
- `dist/announcement-admin-az-1440-light.png`
- `dist/announcement-admin-ru-320-dark.png`

Localization handoff: `docs/role-targeted-announcements-ui-messages.json` (49 keys per language).

## Preview And Release

Local dev preview: `http://127.0.0.1:5243/`, process26384, process-only `VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:8080`. There is no production configuration or backend started here. Static mocked screenshots can be viewed at `/dist/announcement-az-1440-light.png` and `/dist/announcement-admin-ru-320-dark.png`; normal interactive login requires a separately approved local backend. The browser smoke suites provide the interactive mocked flow.

Previous account-deletion changes remain in the original separate worktree/branch and are NOT integrated into this branch. A later authorized integration must reconcile the additive AuthContext changes (particularly the optional profile-aware `isCurrentSession` helper) and run combined end-to-end tests. Do not publish the account-deletion draft until both backend and frontend account-deletion release eligibility is verified. No partial-order-cancellation announcement was added.

This task changes18 files, all scoped to announcements, their auth readiness/isolated-error prerequisites, report CTA, tests and localization/docs. Preview logs, dependencies and screenshots are ignored. No staging, commits, pushes or deployment were performed.
