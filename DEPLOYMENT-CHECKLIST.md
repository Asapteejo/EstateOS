# Deployment Checklist — Modernization batch (2026-07-06)

Covers everything shipped in this session series: enforced CSP, grouped nav,
UI primitives + DataTable migrations, Select/Dialog unification, system-aware
dark mode, PWA, CI, next/image for R2 media, conditional-polling realtime,
webhook idempotency hardening, buyer bottom tab bar — plus the pre-existing
Users tab + MARKETER role batch that ships with it.

---

## 1 · Ship the code

- [ ] `npm run check` green locally (already confirmed).
- [ ] Commit & push via `COMMIT-PROMPT.md` (Claude Code).
- [ ] Open PR `feat/design-system-v2` → `main`. The new GitHub Actions CI
      (`.github/workflows/ci.yml`) runs the same gate on the PR — its first
      ever run, so watch it. If the env-less CI build fails on a missing
      variable, fix the default in `src/lib/config.ts`, not with CI secrets.

## 2 · Pre-deploy environment (Vercel)

- [ ] `R2_PUBLIC_BASE_URL` is present in the **build** environment (not just
      runtime) — the image-optimizer host allowlist is baked at build time.
- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` present
      (conditional polling + rate limits).
- [ ] `ESTATEOS_CSP_REPORT_ONLY` is **unset or "false"** — CSP enforces.
- [ ] Paystack/Clerk/R2/Resend secrets unchanged — nothing in this batch
      rotates credentials.

## 3 · Database migrations (before deploying app code)

Run against production per the runbook (`PROD-MIGRATION-RECONCILIATION.md`):

- [ ] `npm run db:migrate:deploy` applies:
      - `0048_marketer_role` (AppRole MARKETER — already applied to dev)
      - `20260701000111_…` (reconciliation placeholder)
      - `0049_webhook_event_dedup_unique` — deletes historical duplicate
        webhook rows (keeps oldest per event id), then adds the unique index
        on `WebhookEvent(companyId, provider, providerEventId)`. Additive and
        safe to run while the old code is live.
- [ ] Verify: `SELECT indexname FROM pg_indexes WHERE tablename='WebhookEvent';`
      shows `WebhookEvent_companyId_provider_providerEventId_key`.

## 4 · Deploy

- [ ] Merge to `main`; let Vercel build and promote.
- [ ] Build log: confirm `prisma generate` + `next build` complete and the
      route list includes `/manifest.webmanifest` and `/api/realtime/version`.

## 5 · Post-deploy verification (15 minutes, in order)

**CSP (highest risk — first enforced deploy)**
- [ ] Open the admin dashboard and buyer portal with DevTools console open:
      zero CSP violation errors.
- [ ] Sign out/in (Clerk widget loads), open a property page (Mapbox tiles),
      open an uploaded image/receipt (R2), start a test Paystack checkout
      (iframe loads). All are CSP-sensitive surfaces.
- [ ] Rollback lever: set `ESTATEOS_CSP_REPORT_ONLY=true` + redeploy →
      instantly back to report-only.

**Payments (idempotency hardening)**
- [ ] Make one real/demo payment end-to-end: webhook reconciles, receipt
      generated, balance decremented once, buyer email + WhatsApp sent once.
- [ ] Paystack Dashboard → resend the same webhook event: response is
      `duplicate: true`, no second receipt, balance unchanged.

**Realtime (conditional polling)**
- [ ] Two browser tabs (admin + portal): create a lead or payment; both
      surfaces refresh within ~15 s.
- [ ] Network tab shows `/api/realtime/version` every 15 s returning
      `{ enabled: true, version: n }`.

**Images**
- [ ] Property photos load via `/_next/image?...` (network tab) with
      `content-type: image/avif` or `webp` — not full-size originals.

**PWA + mobile**
- [ ] `/manifest.webmanifest` resolves; Android Chrome offers install; icon
      and splash look right.
- [ ] On a phone: buyer portal shows the bottom tab bar (badges work), the
      drawer still opens, dark mode follows system on first visit.

**Nav + tables**
- [ ] Sidebar shows grouped sections for each role (check a STAFF or FINANCE
      user, not just ADMIN); collapse state persists across reloads.
- [ ] Payments / Invoices / Contracts / Marketers tables sort, search, and
      paginate; contract "Send to buyer" and "Regenerate" actions work.

## 6 · Watch for 48 hours

- [ ] Sentry: no new error signatures (especially CSP-adjacent or webhook).
- [ ] Upstash: command volume roughly `dashboards × 4/min` — flat and tiny.
- [ ] Vercel: image-optimization usage rises modestly (expected trade for
      the bandwidth win); function duration stable.
- [ ] Paystack webhook logs: 200s, no retry storms.

## Rollback levers (in escalation order)

1. CSP only: `ESTATEOS_CSP_REPORT_ONLY=true` + redeploy.
2. App: Vercel → promote previous deployment.
3. Migration 0049 is additive — safe to leave in place even when rolling the
   app back; old code simply doesn't rely on the index.
