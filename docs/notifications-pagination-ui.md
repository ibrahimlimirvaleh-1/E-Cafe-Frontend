# Notifications Pagination UI

Publication update: after the separate icon commit `6acaa13`, the user explicitly authorized committing/pushing these remaining18 pagination files. The earlier no-commit/index-empty statements below describe the implementation phase. The icon commit is preserved without rewrite. No PR, merge, deployment or backend modification is performed in this frontend work.

Branch `feat/notifications-pagination-ui`, based on updated `origin/dev` at `aad26ec`. Worktree `frontend-notifications-pagination`; earlier security/account/announcement worktrees are preserved. No production `.env.local` was copied; no live API changes are allowed.

## Tasks

- [x] Add the new paged API helper while retaining the legacy array helper.
- [x] Page-size20 server pagination with existing PaginationControls, page reset/recovery, abort/session guards and quiet background refresh.
- [x] Limit the header preview to page1/size6, retain separate global scoped unread-count/read-all behavior.
- [x] Complete API/CI and browser pagination/read/retry/profile-race/localization/responsive checks, build and dev preview.

No commit/push/merge/deploy. Backend paged route must be released with the UI; there is deliberately no fallback to downloading the full legacy history.

## Contract And Behavior

- New helper: `ecafeApi.notifications.page({pageNumber, pageSize}, signal)` uses `GET /notifications/paged?PageNumber=1&PageSize=20`, returns the existing `PaginatedResponse<NotificationItem>`, defaults20/max100, uses the existing mapper and page metadata helper, rejects malformed/wrong-page responses and defensively removes duplicate IDs while preserving server order. The legacy `notifications.list()` still calls the array endpoint unchanged. Unread count now accepts an optional abort signal; its endpoint/semantics remain unchanged.
- NotificationsPage uses existing PaginationControls with20 default and10/20/50/100 options. Size changes reset page1. Auth user/role/restaurant/session-scope changes remount scoped state at page1; language refresh keeps the selected page. An out-of-range response refetches the last valid page (or page1 for zero records).
- New page requests abort old waits and use query-key/live auth epoch+profile guards. Same-query live refresh keeps rendered rows and pagination; no full-page loading flash. New records replace the current page instead of appending. Stable `createdAt DESC,id DESC` ordering is the server's contract. Offset pagination is not an immutable history snapshot: arriving records can shift later page boundaries, while the requested page number remains unchanged.
- Global scoped unread count is fetched separately, not calculated from the20 visible rows. Read-all remains a single scoped server operation across all pages, including when the current page is already read. One-read/read-all action locks, tenant-denied behavior and profile-aware navigation stay in the existing action hook. Successful actions synchronize the page and header via the existing refresh event; failures do not mark records read optimistically.
- Header preview fetches only page1/size6 plus separate unread count. Existing debounced/pending refresh, backoff, hidden-tab handling and auth blocking remain. Requests abort on unmount/scope change. Non-auth failures have visible retry;401/403 clear protected preview data. Full history is never downloaded by either current UI surface.
- Page loading/error/empty/retry/denied states are distinct. Background network failure retains existing current-page rows plus feedback. Denial clears rows and pagination without signing out a still-valid account. AZ/EN/RU unread plurals are shared by both surfaces.
- The existing date-format fallback is reused to avoid `M11` in incomplete AZ ICU environments. Scoped responsive CSS keeps icon refresh44px and the existing pagination layout usable on320px devices.

## Verification

All browser HTTP and WebSocket requests used mocks, including the real SignalR client transport. No production proxy or live API mutation was used.

| Check | Result |
| --- | --- |
| `scripts/notification-pagination-api-smoke.mjs` |19 passed: defaults/max/invalid input, abort propagation, mapper/order/dedup, metadata shape, empty page, legacy array and separate unread compatibility |
| `scripts/notifications-pagination-smoke.mjs` |24 passed: three pages, size reset, six-item header bound, read-all beyond current page, one-read/error/retry,404/network failures, live page preservation/latest records, out-of-range/empty recovery, denied-scope cleanup, role1-6, profile ABA/new-login stale requests |
| Existing auth/access/profile/email/tenant/notification/account-deletion/announcement suites |283 scenarios passed (36+20+46+22+33+6+51+63+6) |
| Existing date-formatting smoke |Passed |
| TypeScript `tsc -b`, Vite production build |Passed; existing SignalR annotation and large-chunk warnings remain |
| i18n |2484 nonempty matching AZ/EN/RU keys, placeholders and plural tests passed |
| Localization handoff |All8 new keys match `docs/notifications-pagination-ui-messages.json` in all3 languages |
| Git checks |`git diff --check` passed; index empty;18 scoped source/style/helper/CI/test/doc files dirty/untracked |

The Node-only API contract test is wired into `.github/workflows/ci.yml` after build. Existing tenant/browser fixtures were adapted to the new paged response and scoped read-all selector; their legacy assertions and security checks remain. Aborted requests are awaited through fixture completion rather than expecting a browser response after cancellation.

18 screenshots cover AZ/EN/RU at1440/390/320px, light/dark under ignored `dist/notifications-pagination-{language}-{width}-{theme}.png`. AZ1440/light and RU320/dark were visually inspected after the final mobile/date adjustment. They use synthetic records, not real customer data. Early retry/empty-state test timing issues were corrected to wait for connected/settled state and attached (zero-height) empty list, without relaxing application behavior.

## Preview And Handoff

Local preview: `http://127.0.0.1:5245/notifications`. Only a process-local API proxy override targets `http://127.0.0.1:8080`; no backend was started here. For a safe mocked static preview use `/dist/notifications-pagination-az-1440-light.png` or `/dist/notifications-pagination-ru-320-dark.png`. Interactive login needs an isolated matching local backend; the full interactive mocked flow is in the browser test script.

Backend localization handoff: `docs/notifications-pagination-ui-messages.json`,8 keys per language. Backend must provide the new endpoint before/with this UI rollout; a404 shows retry feedback and does not trigger an unbounded legacy request. The backend chat owns synchronization of its pre-existing refund notification translations and any server catalog additions. This frontend task does not modify those files.

Changed boundaries: NotificationsPage/new scoped CSS, NotificationBell, API helper/endpoints, three catalogs, two new tests, CI step, five updated regression fixtures and two docs. Original sibling worktrees and ignored `.env.local` remain untouched. No staging, commit, push, merge, deployment or cross-chat message was performed.

## Publication Recheck

All18 pending files matched their prior verified SHA256 baseline before this documentation update; application/test/CI/catalog content remains unchanged. The previous283-case regression result therefore still applies. Before publication, TypeScript and production Vite build passed again, along with24 pagination browser,19 API-helper,33 tenant-boundary,6 notification-action race and36 auth-race scenarios.2484-key i18n validation also passed. Build cleanup was disabled only to retain the ignored, previously verified brand-only index snapshot; generated output/environment files are not staged. Commit scope is exactly the18 known pagination files, normal push on `feat/notifications-pagination-ui`, with the existing icon commit unchanged.
