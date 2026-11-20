# Restaurant Profile Deactivation UI

Branch: `fix/restaurant-profile-deactivation-ui`, based on frontend `origin/dev` at `bff545a`. Repository changes only; merge, deployment, APK publication, production data and live account changes are separate operations.

## Contract

- `User.IsActive` means the account is blocked/active. `UserRestaurant.IsActive` means a restaurant profile is inactive/active.
- Staff create/edit status controls send the existing `IsActive` field with profile semantics. Staff activation never unblocks a globally blocked account. `StaffAccountInactive` / `1140` / HTTP 409 is shown as a localized error without logging out the administrator.
- Profile activate/deactivate events use `RestaurantAccessChanged` with `restaurantId`, `reason: staff_activated | staff_deactivated`, optional/empty `message`, and `occurredAtUtc`.
- `GET /profile.profiles` is authoritative, including an empty list. An active account with no restaurant profiles uses Customer role 5, empty assignments/restaurant IDs/management permissions, and no restaurant header context. It stays signed in. Stored backend account role is not changed by this UI.
- Memberships remain in the profile list when contracts expire. `ContractTerminated`, `ContractExpired`, and `ContractActivated` refetch protected data for the affected current scope, without document reload or navigation. Other-tenant events leave the active page mounted. Role events refresh protected data even when the scope ID stays the same.
- Genuine `UserDeactivated`, inactive-account profile response, expired sessions/password reset, and logout-all still terminate authentication. Accounts incorrectly globally blocked by the old backend are not automatically unblocked.

## Reconciliation

One coordinator handles startup, realtime changes, reconnect/online, focus/visibility and the scheduled 60-second check. It preserves the current selected profile if still active; otherwise it chooses a remaining active profile and its home, or the personal customer home when none remain.

Session epochs discard work from an earlier login, request sequence IDs discard older profile snapshots, and explicit selection intent stops the old route guard from undoing a user's profile switch. Previous authRevision refresh protections remain unchanged. A stale platform-admin JWT is immediately downgraded when the authoritative profile response supplies a non-admin effective role, even if refresh fails.

Verified profile lists and the current tab's chosen context govern `X-Active-*` headers, not obsolete JWT assignments or another tab's latest storage selection. A normal token refresh cannot resurrect an authoritative empty profile list. Explicit session transitions clear that in-memory verified context.

Protected subtrees are keyed by authenticated user/restaurant/role and access revision so data/actions from a removed scope do not survive. Profile-list-only changes do not remount unaffected content. Profile status messages use localized info/success copy; staff failures use explicit danger tone.

## Verification

Verified November 21, 2026 (Asia/Baku), against mocked HTTP and WebSocket services only:

- TypeScript and Vite production build passed. Existing SignalR annotation/large-chunk warnings remain.
- `scripts/profile-deactivation-smoke.mjs`: 27 browser scenarios with the actual SignalR client and intercepted transport, two restaurants/two browser contexts, current/other removal, empty list, reactivation, missed-event reconnect, scheduled polling/focus, selection/login/out-of-order races, contract data refetch, role events, global blocks/expiry/logout-all, 409 error tone and create/edit false payloads.
- `scripts/access-profiles-smoke.mjs`: 16 profile rules including stale SuperAdmin demotion, legitimate global admin, permissions and tab-scoped headers.
- Existing `scripts/auth-refresh-race-smoke.mjs`: 16 deterministic cases passed.
- Existing `scripts/email-change-security-smoke.mjs`: 20 scenarios passed; staff fixtures now include actual active memberships, matching the new contract.
- Existing file-upload and staff-role localization smokes passed; 2,385 matching AZ/EN/RU catalogue keys and `git diff --check` passed.
- 22 profile screenshots: 1440/390/320px, AZ/EN/RU, light/dark, plus fallback/personal notices. Images live under ignored `dist/profile-deactivation-*`, `dist/profile-fallback-*`, `dist/profile-personal-*`.

The 18 new `ui.profiles.*` keys are provided in `docs/restaurant-profile-ui-messages.json`; backend owner confirmed catalogue integration.

Safe static QA preview on the existing local frontend preview: `http://127.0.0.1:5242/profile-deactivation-az-1440-light.png` or `http://127.0.0.1:5242/profile-deactivation-ru-320-dark.png`. Interactive frontend route remains `/admin/staff`; a matching local backend is required for real integration testing. The pre-existing local proxy configuration was left untouched and was not used for validation. No real end-to-end/live-account claim is made.
