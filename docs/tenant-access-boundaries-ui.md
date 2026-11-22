# Tenant Access Boundaries UI

Branch: `security/tenant-access-boundaries-ui`, based on `origin/dev` at `1f7b32a`.
Scope: frontend alignment with platform-only account deletion/groups and live notification membership authorization.

## Tasks

- [x] Restrict global account deletion to platform administrators, with explicit cross-restaurant confirmation. Preserve restaurant-scoped activation/deactivation for owners/managers.
- [x] Prevent delayed notification reads/mutations/navigation from crossing profile/session boundaries; clear denied tenant content and show recoverable feedback without signing out an otherwise active account.
- [x] Remove restaurant-group list calls from owner/manager restaurant screens; retain existing admin-only routes and workflows.
- [x] Verify role/notification races, existing auth/profile tests, localization, TypeScript/build and desktop/mobile appearance using mocked HTTP/WebSockets only.

Implementation and verification initially excluded commit/push. On November 23, 2026, the user explicitly authorized committing and pushing only these three security fixes in both repositories. Merge/deploy/APK and live data operations remain excluded. Preserve existing `.env.local` and unrelated worktrees.

## Implemented Boundaries

Global account deletion is shown and handled only for effective PlatformAdmin1 with ManageUsers. The staff screen uses the explicitly global `users.delete` API after confirmation naming the user and warning that all restaurant access is removed. Cancel sends no DELETE; concurrent confirms send one DELETE. Owner/Manager retain existing restaurant-scoped activation/deactivation, including the prior owner restriction. Frontend hiding is not an authorization boundary: the backend must enforce its new controller/service rules.

RestaurantManagementPage no longer loads the global group directory for Owner/Manager. Existing admin-only route/navigation rules and RestaurantEditPage's existing platform-only group loader remain unchanged. Platform admin group list/create still work.

The existing notification list request-ID and keyed async-data protections are preserved. Bell state is additionally keyed by session/access revision and selected user/restaurant/role. GET403 clears the denied tenant's items/count rather than retaining previously loaded data; POST403 is handled without an unhandled rejection, navigation or optimistic success. Tenant403 does not sign out an otherwise active account. Customer and platform-admin notifications are not client-filtered to a single restaurant.

`useNotificationActions` shares the two notification surfaces' mutation/navigation guards. Each observed profile/session boundary creates a distinct scope object, preventing A-B-A revival even without remounting. Pending ownership is per scope/operation: B can start while A is unfinished, and A's completion cannot unlock B or clear B's errors. Unmount/scope cleanup aborts only that scope's mutation requests. The AbortSignal is forwarded through the existing notification APIs, so an A401 waiting for refresh cannot replay POST read/read-all with B's active headers. This does not change shared HTTP refresh logic.

## Verification

Verified November 22, 2026 (Asia/Baku), with mocked HTTP and actual SignalR client/intercepted WebSocket transport. No production proxy/API was used.

- TypeScript and Vite production build passed. Existing SignalR annotation and large-bundle warnings remain.
- `tenant-access-boundaries-smoke.mjs`: 33 browser scenarios. Owner/Manager deletion restrictions despite stale ManageUsers/ManageRestaurants claims; scoped activate/deactivate; five group-related routes per role with zero global group requests; platform-admin group create/list; AZ/EN/RU cancel/confirm/double-submit; delayed list/read/read-all across profile switches; denied-tenant list/read/read-all cleanup on both surfaces; revoked A/active B realtime fallback; genuine Customer/Admin mixed-restaurant feeds; two expired-token refresh/replay races.
- `notification-actions-race-smoke.mjs`: 6 direct production-hook browser scenarios without remount. Old success/403/500 cannot unlock a new operation; scoped abort signals; duplicate prevention; A-B-A and same-user new-session epoch; denied-scope recovery. Dependencies are mocked, while React and the hook implementation are bundled from the repository.
- Existing auth refresh race suite: 36 passed. Existing access-profile rules: 20 passed. Existing profile/login browser suite: 46 passed. Existing email-change security suite: 22 passed. These total 163 named scenarios including the 39 new scenarios.
- Existing staff-role localization smoke passed. i18n verification: 2,393 matching nonempty AZ/EN/RU keys with matching placeholders/plurals.
- 18 confirmation screenshots cover AZ/EN/RU, 1440/390/320px and light/dark; two English notification-denial screenshots cover 1440/320px. Overflow assertions pass. AZ1440/light confirmation, RU320/dark confirmation and EN320 notification denial were inspected.
- `git diff --check` passed; nothing is staged. Only this task's files are dirty/untracked.

## Changed Files

- `src/pages/admin/StaffManagementPage.tsx`: platform-only confirmed global deletion.
- `src/pages/admin/RestaurantManagementPage.tsx`: role-gated group loader.
- `src/shared/layout/NotificationBell.tsx`, `src/pages/customer/NotificationsPage.tsx`: scope-safe loading/actions and denied-content cleanup.
- `src/shared/notifications/useNotificationActions.ts`: shared scoped mutation, cancellation and navigation guard.
- `src/shared/api/ecafeApi.ts`: strict notification list errors and optional mutation AbortSignals.
- `src/shared/i18n/catalog/{az,en,ru}.json`: seven tenant-access messages.
- `scripts/tenant-access-boundaries-smoke.mjs`, `scripts/notification-actions-race-smoke.mjs`: focused mocked regressions.
- This task document and `docs/tenant-access-boundaries-ui-messages.json`: checklist, results and localization handoff.

## Integration And Remaining Risks

The seven `ui.tenantAccess.*` keys in `tenant-access-boundaries-ui-messages.json` match the local backend `tenant-access-ui.server.json` values in all three languages. No additional key or copy change is needed. Backend authorization and SQL live membership/account/restaurant checks remain mandatory for direct API calls, old tokens and already-sent requests; cancelling UI work cannot undo an operation already accepted by the server. No live end-to-end/database authorization claim is made by these frontend tests.

The ignored pre-existing `.env.local` production proxy and sibling worktrees were left untouched. At the verification handoff no commit or push had been performed; the later publication authorization does not authorize merge, deployment or APK publication. Existing static preview images are safe to inspect at `http://127.0.0.1:5242/tenant-delete-ru-320-dark.png` and `http://127.0.0.1:5242/tenant-notifications-denied-320.png`; do not use interactive preview routes against the production proxy for testing.
