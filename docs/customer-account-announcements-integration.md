# Customer Account And Announcements Integration

Date: November 23, 2026 (Asia/Baku).
User authorization: commit/push all pending account-deletion and announcement work on both sides. No PR merge, deployment, APK or production mutation is authorized or performed.

## Preserved History

- Account deletion: `feat/customer-self-account-deletion-ui`, `9b9ccf5bd9976d682a09ca32247d8e7ebe404b34`, 13 files.
- Announcements: `feat/role-targeted-announcements-ui`, `46c39492ac75c83867fc31da267176dcf47ec010`, 18 files.
- Combined branch: `feat/customer-account-announcements-ui`, normal non-fast-forward merge of the two preserved source commits. No stash, reset, cherry-pick or force push.
- Base: `f484d9286a29ca1d9ecf4577ecbd51ffa33e37f0`, matching fetched `origin/dev`.

Worktree: `C:\Users\mirvaleh.ibrahimli\Documents\Codex\2026-07-20\dem\frontend-role-announcements`.
Original account-deletion worktree stays on its own committed branch. Unrelated sibling worktrees were not modified.

## Integration

- Resolved all four merge conflicts explicitly: three catalogs retain both features' keys; AuthContext retains account-deletion success/logout and verified-profile readiness.
- A single backwards-compatible `isCurrentSession(ownerId, epoch, roleId?, restaurantId?)` implementation supports the deletion flow's session checks and announcements' optional live profile checks. Duplicate automatically merged declarations and properties were removed; the memo dependency union preserves both features.
- Account-deletion epoch invalidation also clears announcement profile readiness. A stale announcement GET/receipt cannot navigate after deletion or affect a newer login. A delayed deletion response cannot log out a newer session.
- The CustomerProfile announcement CTA only opens `/account`. It does not open the deletion dialog or send its eligibility request. Deletion still needs an explicit action, current password and irreversible-action consent. The sensitive account route/dialog does not show an announcement overlay.
- The backend's account-deletion announcement seed remains a draft. This integration does not publish anything. Publication still requires explicit administrator verification of the deployed release.
- Existing separate reports describe the original isolated verification; this document records combined verification and supersedes their no-commit/no-integration status statements.

## Combined Verification

- [x] Production build from the combined source: TypeScript and Vite passed. Existing SignalR annotation and large-bundle warnings remain.
- [x] Announcements browser suite: 63 passed, including five new combined cases (AZ/EN/RU CTA-to-profile-to-explicit-deletion, early realtime/new-login with stale GET+POST, stale CTA receipt after deletion).
- [x] Account-deletion browser suite: all51 passed against this same combined build, not the former isolated artifact.
- [x] Existing auth/access/deactivation/email/tenant/notification suites: 163 passed; development StrictMode: 6 passed. Total named scenarios across these suites and the two features: 283. Dashboard roles/filters/CSV/refresh/responsiveness and file-upload/staff-role localization suites also passed.
- [x] Catalog verification: 2471 matching AZ/EN/RU keys; both features' 78 UI keys match their backend resources in all3 languages.

All HTTP and WebSocket traffic in browser suites is mocked. No production `.env.local` was copied, changed, committed or used. Screenshots, `dist`, preview logs and dependency junctions stay ignored. Source/docs/tests only are included.

## Preview

The local preview at `http://127.0.0.1:5243/` now serves the combined source, with process-only proxy target `http://127.0.0.1:8080`. No backend was started here. Static mocked screenshots are available at `/dist/announcement-az-1440-light.png`, `/dist/announcement-admin-ru-320-dark.png` and `/dist/account-deletion-ready-ru-320-dark.png`. Real isolated backend integration, PR merge and deployment remain separate actions.
