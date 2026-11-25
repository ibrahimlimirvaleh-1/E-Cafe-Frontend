# Brand Icon UI

Date: November25,2026 (Asia/Baku).
Publication update: the user subsequently requested pushing the latest icon work only. Exactly these5 brand files are staged/committed on the existing branch; the18 pagination files remain uncommitted. Earlier no-commit/index-empty statements below describe the implementation phase. No merge, deployment, PR creation or backend changes are authorized by this update.
Worktree: `C:\Users\mirvaleh.ibrahimli\Documents\Codex\2026-07-20\dem\frontend-notifications-pagination`.
Branch: `feat/notifications-pagination-ui`, HEAD unchanged at `aad26ec78273785253af34391f6959770b6a5429`.

## Tasks

- [x] Inspect shared Brand usages, source PNG, existing Lucide Coffee geometry and responsive/sidebar sizing.
- [x] Replace only Brand's raster presentation with a transparent library-icon rendering: white cup/steam, black contour, no background plate.
- [x] Preserve32/28px dimensions and collapsed/mobile layout; retain accessible link naming when brand text is hidden.
- [x] Verify all shared surfaces with mocked Playwright screenshots, SVG alpha/pixel checks, build/typecheck and pagination regressions.
- [x] Verify all18 pre-existing pagination files are byte-for-byte unchanged.

## Scope

Changed files for this narrow follow-up:

- `src/shared/layout/Brand.tsx`: uses the installed Lucide `Coffee` icon rather than `<img src="/ecafe-icon.png">`. Two coincident library strokes provide a black outer contour and white interior/steam, including on dark surfaces. No custom SVG geometry was drawn. Coffee identity is retained using the library's standard cup shape; the old PNG's decorative curl is not traced/recreated.
- `src/shared/layout/brand.css`: two library SVGs occupy one fixed grid cell, do not shrink or receive pointer events, and have no painted background.
- `src/styles/globals.css`: extends only the three existing brand-image dimension selectors to the new span, keeping32px desktop/28px mobile sizing. Brand gap, text sizing and layout rules are unchanged.
- `scripts/brand-icon-smoke.mjs`: new focused mocked visual/pixel regression.
- This report.

The shared component covers public/customer headers, waiter/kitchen headers, admin sidebar (expanded/collapsed/mobile drawer) and login/register/forgot/reset/setup/email-confirmation cards. The link's explicit accessible name remains available with collapsed text. The source PNG and favicon remain byte-identical to HEAD: the PNG is still used by SafeImage fallbacks and restaurant-cover styling, which were deliberately not changed. No raster asset editing or backend modification was performed.

## Verification

- **44 brand scenarios passed**: public/customer/waiter/kitchen/admin at1440/390/320px in light/dark; expanded and collapsed desktop sidebar; mobile drawer; six auth variants at320px in both themes. The one initial test locator typo (`admin-sidebar-toggle` instead of the existing `admin-sidebar-collapse`) was corrected; application behavior was not changed for that test.
- Geometry assertions verify exactly32/28px, no document overflow and centered collapsed positioning (less than1px deviation). PNG/favicon unchanged assertions use `git show HEAD` byte comparisons.
- Pixel checks render the actual library layers on a96px transparent canvas: all four corners have alpha0, over35% of the canvas is transparent, white/black regions and steam colors are present. Actual on-page PNG screenshots are also decoded and checked for nonblank content and nonwhite dark-mode corner pixels, catching an opaque background plate.
- **24 pagination browser scenarios and19 API-helper cases passed again** against the build containing the icon change. Existing pagination implementation/tests/docs/catalogs/CI files were not edited: SHA256 comparison of all18 baseline files reported18 preserved,0 changed.
- TypeScript and Vite production build passed. Existing SignalR PURE-annotation and large-chunk warnings remain. `git diff --check` passed; index remains empty.
- Brand screenshots and `dist/brand-icon-pixel-report.json` remain ignored. HTTP/WebSocket calls in the brand test are mocked; no production proxy/API was used. Representative public desktop light/dark, waiter320/dark and collapsed admin1440/dark screenshots were visually inspected.

## Preview

The existing hidden Vite preview at `http://127.0.0.1:5245/` serves this worktree (process-local API proxy override targets `http://127.0.0.1:8080`; no backend was started). Safe mocked screenshots:

- `/dist/brand-public-1440-dark.png`
- `/dist/brand-public-1440-light.png`
- `/dist/brand-waiter-320-dark.png`
- `/dist/brand-admin-collapsed-1440-dark.png`
- `/dist/brand-admin-320-dark.png`

No staging, commit, push, merge, deployment or cross-chat message was performed. Total current dirty/untracked files are the original18 pagination files plus these5 brand files,23 overall. No ignored environment/build/screenshot files are included.

## Brand-Only Publication Check

The subsequent user push request is scoped only to these5 brand files, on the existing `feat/notifications-pagination-ui` branch despite its name. The18 pagination files remain local, byte-for-byte unchanged, and are not part of this commit. No backend files are included or modified.

The exact staged index was exported with `git checkout-index` to ignored `dist/brand-index-verification-20261125/`. That independent copy contains base HEAD's API, notification page and CI configuration, and does not contain the pending pagination test or `.env.local`. TypeScript, Vite production build and all44 brand pixel/layout scenarios passed there again, proving the brand change builds without pending pagination implementation. Existing SignalR annotation and large-chunk warnings remain. Only this report was subsequently expanded; the four staged runtime/test file hashes stayed identical to the verified snapshot's index content. Generated files and dependencies remain ignored. Normal branch push only; no force push, PR creation, merge or deployment.
