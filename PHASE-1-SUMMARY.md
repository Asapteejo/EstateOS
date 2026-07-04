# Phase 1 — Production Safety Hardening — Final Summary

Scope: production-safety fixes only. No app redesign. One company is live in
production, so every change prioritized backward compatibility and fail-open
behavior.

---

## 1. Files changed

### A. Production DB / dev-bypass safety (Items 1–3)
- `src/lib/db/production-db-guard.ts` — removed hardcoded production project ref + host; now sourced from env.
- `src/lib/config.ts` — `allowDevBypass` is force-disabled when the configured DB is the known production DB.
- `src/lib/db/production-db-guard.test.ts` — updated + added a fail-open test.
- `src/lib/config.test.ts` — added dev-bypass-vs-production tests.
- `.env.example` — replaced real ref/host with empty placeholders + guidance.
- `.env.local` — (gitignored, your machine only) set production identifiers and disabled writes/bypass against prod.

### B. Rate limiting (Item 4)
- `src/lib/rate-limit.ts` — extended with reusable `enforceRateLimit()` + `getClientIp()` and all limiters.
- `src/lib/rate-limit.test.ts` — new unit tests for the helper.
- 27 route handlers got a post-auth rate-limit guard:
  - Public/portal: `payments/initialize`, `payments/verify`, `uploads/sign`, `uploads/documents`, `portal/kyc-submissions`, `reservations`, `saved-properties`, `accept-invitation/[token]`.
  - Admin: `admin/communication-wallet/top-up`, `admin/team-invitations`, `admin/team-invitations/[id]/resend`, `admin/automation/run`, `admin/exports/clients`, `admin/exports/transactions`, `admin/exports/payments`, `admin/payment-requests`, `admin/inquiries/[inquiryId]/reply`, `admin/inquiries/[inquiryId]/draft-reply`, `admin/transactions/[transactionId]/follow-up`, `admin/domain/verify`, `admin/kyc-submissions/[submissionId]`, `admin/properties/verification/run`, `admin/support/[requestId]/retry`, `admin/onboarding/sample-data`.
  - Superadmin: `superadmin/communication-wallets/[companyId]/adjust`, `superadmin/companies/[companyId]/status`, `superadmin/companies/[companyId]/domain`.

### C. CSP report-only (Item 5)
- `next.config.ts` — added `Content-Security-Policy-Report-Only` header + policy constant; existing 4 security headers untouched.

### D. Mobile/tablet dashboard navigation (Item 6)
- `src/components/portal/dashboard-mobile-nav.tsx` — new client component (sticky top bar + slide-in drawer).
- `src/components/portal/dashboard-shell.tsx` — renders the new component; sidebar now `hidden lg:block`.

Total: ~38 files (2 of them env files; 1 is gitignored).

---

## 2. What was fixed

**Production DB / dev-bypass safety.** The dev auth bypass could previously run
against the live production database, and the production Supabase project ref +
host were hardcoded in committed source. Now: the production identifiers live in
env vars (placeholders in `.env.example`), and `allowDevBypass` is forced to
`false` whenever the active `DATABASE_URL`/`DIRECT_URL` matches the configured
production DB — even if `ESTATEOS_ENABLE_DEV_BYPASS=true` is left on. Fail-open:
if no production identifier is configured, nothing changes.

**Rate limiting.** State-changing and cost-incurring endpoints (payments,
uploads, KYC, invitations, AI drafting, data exports, admin/superadmin
mutations) are rate-limited per-IP (public) or per-IP + per-user
(authenticated), via a shared `enforceRateLimit()` helper returning HTTP 429
with a `Retry-After` header. Fail-open: with no Upstash configured the limiter
is a no-op, so behavior is unchanged until Redis is added.

**CSP report-only.** A `Content-Security-Policy-Report-Only` header now reports
violations in browser DevTools **without blocking anything**. The allowlist is
derived from the services actually used (Clerk, Paystack, Mapbox, PostHog,
Sentry, Cloudflare R2, Unsplash, Vercel). It is intentionally not enforced yet.

**Mobile/tablet navigation.** Below `lg`, the stacked 13-/21-link tile grid that
pushed content down is replaced by a sticky top bar + accessible slide-in drawer
(Escape/backdrop/link-click close, focus trap + restore, body scroll lock,
44px tap targets). Desktop sidebar behavior is unchanged. No routes or nav items
were removed.

---

## 3. Remaining manual steps (local)

1. **Point local development at a non-production database.** Update `DATABASE_URL`
   and `DIRECT_URL` in your local `.env.local` to a local/staging Supabase or
   Postgres instance. This is the operational half of Item 1 — the code guard is
   done, but you must stop pointing dev at prod.
2. **Confirm `.env.local` has** `PRODUCTION_DATABASE_PROJECT_REF`,
   `PRODUCTION_DATABASE_HOST`, `ALLOW_PRODUCTION_DB_WRITES="false"`, and that
   `ESTATEOS_ENABLE_DEV_BYPASS` is only ever `true` against a local DB.
3. **Review the diffs** (especially the 27 route handlers and `next.config.ts`).
4. **Run the build/test commands below** in a real Windows environment (the
   assistant's Linux sandbox can't run this project's Windows-built toolchain).
5. **Decide on Upstash** — rate limiting only engages once Upstash env vars exist.

---

## 4. Commands to run on Windows before deployment

```powershell
# from the project root
npm install            # ensure deps match lockfile
npm run typecheck      # tsc --noEmit
npm run test           # tsx --test (runs the new rate-limit + guard tests)
npm run lint
npm run build          # full Next production build — must pass before deploy
```

Or all at once:

```powershell
npm run check          # test + typecheck + lint + build
```

Then a quick local smoke test:

```powershell
npm run dev
# visit /admin and /portal on a narrow window: confirm sticky bar + drawer
# open DevTools > Network > document request: confirm Content-Security-Policy-Report-Only header
# open DevTools > Console: note any [Report Only] CSP violations during real flows
```

---

## 5. Environment variables to add / verify

### Supabase / database
- `DATABASE_URL`, `DIRECT_URL` — production values stay in Vercel (prod). Local dev should point elsewhere.

### Production DB guard (verify in Vercel — Production scope)
- `PRODUCTION_DATABASE_PROJECT_REF` — your prod Supabase project ref.
- `PRODUCTION_DATABASE_HOST` — your prod DB host.
- `ALLOW_PRODUCTION_DB_WRITES` — leave unset/`false` unless intentionally writing to prod from a script.
- `ESTATEOS_ENABLE_DEV_BYPASS` — must be **absent or `false`** in Production. (Belt-and-suspenders: the guard now also blocks it, but don't rely on that.)

### Upstash Redis (add to enable rate limiting)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- Both required together. Without them, rate limiting silently fails open
  (no protection, no errors). Add them in Vercel (Production + Preview) to turn
  protection on.

No new variables are required for CSP or the mobile nav.

---

## 6. Deployment risk level: **LOW**

- Every change is fail-open and backward compatible.
- CSP is report-only — it cannot block anything.
- Rate limiting is a no-op until Upstash is configured; once on, limits are
  generous and isolated per IP/user.
- The DB guard only *removes* a dangerous capability; it can't break prod runtime.
- The nav change is presentational and desktop is untouched.
- Main caveat: a full local `npm run build` has not been run in a real
  environment yet — do that first (Section 4).

---

## 7. Rollback plan

- **Whole phase:** `git revert` the Phase 1 commits (or redeploy the previous
  Vercel build via the dashboard — instant, no rebuild).
- **Rate limiting only:** remove `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` in Vercel and redeploy — limiters fail open and all
  routes behave exactly as before, no code change needed.
- **CSP only:** delete the `Content-Security-Policy-Report-Only` header entry in
  `next.config.ts` (or just ignore it — it's report-only and harmless).
- **Mobile nav only:** revert `dashboard-shell.tsx` + delete
  `dashboard-mobile-nav.tsx`.
- **DB guard:** if `allowDevBypass` is wrongly disabled in a non-prod env,
  unset `PRODUCTION_DATABASE_PROJECT_REF` / `PRODUCTION_DATABASE_HOST` there to
  restore fail-open behavior.

Per-area rollbacks are independent, so a problem in one item never forces
reverting the others.

---

## 8. Suggested Phase 2

1. **Enforce CSP.** Monitor report-only violations for ~1–2 weeks, tune the
   allowlist, move to a nonce-based `script-src` with `'strict-dynamic'` via
   middleware, drop `'unsafe-inline'`/`'unsafe-eval'`, then switch the header to
   the enforcing `Content-Security-Policy`.
2. **Broaden rate-limit coverage.** Extend to the remaining admin CRUD/GET
   routes not in the first batch, and add a CSP/violation + 429 reporting sink.
3. **Caching & performance.** Review data fetching in the dashboard shell
   (per-request DB queries), add caching where safe.
4. **UI primitives / fonts.** Consolidate shared UI components and font loading.
5. **Auth/session hardening review.** Audit the `require*Session` guards and
   tenant-scoping helpers end to end.

Recommended first Phase 2 task: **CSP enforcement**, since the report-only
monitoring window starts now and the rest can proceed in parallel.
