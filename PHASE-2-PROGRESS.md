# Phase 2 — Progress Summary (pre-CSP-enforcement)

Scope so far: typography reliability, loading/error states, dashboard shell
caching/performance, and broadened admin rate-limit coverage. CSP is still
**report-only** and has not been enforced. Every change kept behavior backward
compatible and fail-open.

---

## 1. Files changed in Phase 2

### Item 1 — Fonts / typography (2 files)
- `src/app/layout.tsx` — load Inter + Libre Baskerville via `next/font`.
- `src/app/globals.css` — point `--font-sans` / `--font-serif` and `body` at the web fonts (old system fonts kept as fallbacks).

### Item 2 — Loading / error states (5 new files)
- `src/app/global-error.tsx` (new) — root global error boundary.
- `src/app/(admin)/admin/transactions/loading.tsx` (new)
- `src/app/(admin)/admin/payments/loading.tsx` (new)
- `src/app/(admin)/admin/analytics/loading.tsx` (new)
- `src/app/(admin)/admin/listings/loading.tsx` (new)

### Item 3 — Dashboard shell caching / performance (2 files)
- `src/components/portal/dashboard-shell.tsx` — parallelized independent awaits; cached tenant presentation (60s) and unread-notification count (15s), tenant-scoped.
- `src/modules/branding/service.ts` — `revalidateTag` on branding publish to invalidate the presentation cache immediately.

### Item 4 — Broadened admin rate limiting (35 route files)
No change to `rate-limit.ts` (reused existing limiters). Newly covered:
- Billing: `billing/plans`, `billing/plans/[planId]`, `billing/subscriptions`, `billing/subscriptions/[subscriptionId]`
- Payments/finance: `payment-account`, `payment-requests/[paymentRequestId]`, `transactions/[transactionId]`
- Properties: `properties` (POST), `properties/[propertyId]`, `properties/[propertyId]/status`, `properties/[propertyId]/verify`
- CRM/bookings: `reservations/[reservationId]`, `inspections/[bookingId]`, `inquiries/[inquiryId]`, `testimonials/[testimonialId]`, `wishlists/[wishlistId]`
- Config: `settings`, `settings/branding`, `settings/contracts`, `settings/contracts/templates/[templateId]/activate`, `…/archive`, `domain`
- Ops: `incidents/[incidentId]/resolve`, `…/ignore`, `…/unignore`
- Deals/team: `deals`, `deals/property`, `team-members`, `team-members/[teamMemberId]`
- Bulk/AI: `wishlists/reminders/run`, `development-calculations`, `development-calculations/[calculationId]` (PATCH+DELETE), `…/versions`, `…/decision`, `feasibility/[calculationId]/narrative` (AI limiter)

---

## 2. What was fixed

**Fonts/typography.** The app previously assumed Windows/Office-only fonts
(Aptos, Baskerville Old Face) that did not load on Mac/iOS/Android/Linux. Now
Inter (body) and Libre Baskerville (headings) are self-hosted via `next/font`
and render identically on every OS. No external CDN, so no CSP change needed.

**Loading/error states.** Added a root `global-error.tsx` last-resort boundary,
and page-shaped skeletons for the four heaviest admin pages (Transactions,
Payments, Analytics, Listings). Deal Board already had a skeleton and was left
alone. Skeletons reuse existing `admin-ui` primitives; no spinners.

**Dashboard shell caching/performance.** Independent queries now run
concurrently (`Promise.all`), and two reads are cached briefly and
tenant-scoped: tenant presentation/branding (60s, invalidated immediately on
branding publish) and the unread-notification count (15s). This cuts repeated DB
work on every authenticated navigation without changing behavior.

**Broader admin rate limiting.** Extended Phase 1 coverage from 16 admin routes
to 51 — all remaining destructive, payment/billing, external-call, bulk-action,
verification, status-changing, and AI admin mutations. Read-only GETs and cheap
idempotent notification-read toggles were intentionally excluded.

---

## 3. What still needs manual testing

- **Fonts:** confirm Inter/Libre Baskerville render on Windows, Mac, iOS,
  Android, Linux; check headings (`font-serif`) and body; verify font files load
  same-origin from `/_next/static/media` (DevTools → Network → Font).
- **Loading:** with Network throttling (Slow 3G), navigate to Transactions,
  Payments, Analytics, Listings — skeleton appears immediately, no layout jump.
- **Global error:** temporarily throw in `RootLayout` (production build) to
  confirm `global-error.tsx` renders and reports to Sentry/PostHog; remove after.
- **Caching correctness:** branding publish reflects immediately; notification
  badge updates within ~15s; two different tenants/users never see each other's
  branding or counts.
- **Rate limiting (with Upstash):** exceed a limit on a few newly covered routes
  (e.g. `properties/[id]/status` >60/min; `feasibility/[id]/narrative` >15/10min)
  → expect HTTP 429 + `Retry-After`; confirm a second user is unaffected.

---

## 4. Commands to run locally before deploy (Windows)

```powershell
npm install
npm run typecheck
npm run test
npm run lint
npm run build      # must pass — also fetches next/font files (needs network)
```

Or all at once:

```powershell
npm run check
```

Then smoke test:

```powershell
npm run dev
# narrow window: /admin and /portal — fonts, skeletons, drawer, badges
# DevTools Network: fonts same-origin; CSP-Report-Only header still present
```

> Note: `npm run build` requires network access the first time so `next/font`
> can download the Google font files (cached afterward).

---

## 5. Environment variables to verify

No **new** variables were introduced in Phase 2. Verify the existing ones:

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — required (together) for
  rate limiting to actually engage. Without them everything fails open (no
  protection, no errors). Set in Vercel Production + Preview to enable the now-
  much-broader coverage.
- Production DB guard vars from Phase 1 remain as set: `PRODUCTION_DATABASE_PROJECT_REF`,
  `PRODUCTION_DATABASE_HOST`, `ALLOW_PRODUCTION_DB_WRITES=false`, and
  `ESTATEOS_ENABLE_DEV_BYPASS` absent/false in Production.

---

## 6. Deployment risk level: **LOW**

- Fonts: visual-only; system-font fallbacks remain. Only caveat: the build must
  have network access to fetch fonts (CI/Vercel do).
- Loading/error: purely additive framework convention files.
- Caching: fail-safe; worst case is ≤60s stale branding name or ≤15s stale
  notification badge. Branding publish invalidates immediately.
- Rate limiting: fail-open without Upstash; generous limits; per-IP+user scoped.
- No routes, success response shapes, business logic, or auth flows changed.
- Main caveat: a full `npm run build` hasn't been run in a real environment yet.

---

## 7. Rollback plan

Each item reverts independently:

- **Fonts:** revert `layout.tsx` + `globals.css` (system fonts return).
- **Loading/error:** delete the 5 new files (no other code depends on them).
- **Caching:** revert `dashboard-shell.tsx` + the `revalidateTag` line in
  `branding/service.ts`. Or, to neutralize caching only, the 60s/15s windows are
  short enough that issues self-resolve quickly.
- **Rate limiting:** remove `UPSTASH_REDIS_REST_URL`/`TOKEN` in Vercel and
  redeploy → all limiters fail open instantly, no code change needed.
- **Everything:** redeploy the previous Vercel build for an instant full
  rollback, then `git revert` the Phase 2 commits at leisure.

---

## 8. Recommended next step

**Phase 2 item 5 — CSP enforcement.** The report-only policy has been live; the
next step is to (a) review collected violation reports from real usage, (b) tune
the allowlist (remove unused entries, add any missing hosts), (c) move
`script-src` to a nonce-based policy with `'strict-dynamic'` via middleware and
drop `'unsafe-inline'`/`'unsafe-eval'`, then (d) switch the header from
`Content-Security-Policy-Report-Only` to the enforcing `Content-Security-Policy`.
Recommend enforcing on a preview deployment first and watching for breakage
before production.
