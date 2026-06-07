# Design System v2 — Final Review Checklist (`feat/design-system-v2`)

Run this before merging to `main`. You can run it on a **Vercel preview** (best for
realistic perf + sharing) or **local dev** (easiest for switching roles via Dev Access).

## How to run it

**Switching roles**
- Local dev: use the Dev Access panel presets (Public / Portal / Admin / Superadmin).
- Preview deploy: Dev Access bypass should be OFF on a deployed env, so sign in with a real
  Clerk account that has the role (you're a super-admin; use a buyer/admin test account or
  switch back to local for those).

**Preview pre-flight (do these first if reviewing on a Vercel preview)**
- [ ] Confirm the preview env uses a **non-production database** (not the live `DATABASE_URL`).
- [ ] Confirm `ESTATEOS_ENABLE_DEV_BYPASS` / `DEV_ACCESS_MODE` are **off** on the preview.
- [ ] (Optional) `UPSTASH_REDIS_REST_URL` + token set if you want to test rate limiting.

---

## 1. Public / marketing (signed out)
- [ ] `/` (signed out) → EstateOS **platform** homepage (dark hero, feature cards).
- [ ] `/platform` → platform homepage; header nav is **one line** (Properties, Features, Pricing,
      Contact, **Resources** dropdown) + Get Started; **no wrapping**, full "REAL ESTATE SAAS" tagline.
- [ ] Resources dropdown opens and all links work.
- [ ] Tenant site (`acme-realty.localhost` or `/?devTenant=acme-realty`) → Acme tenant homepage;
      tenant header: "Buyer Portal" + "Explore Listings" on **one line**, tagline not clipped.
- [ ] Resize narrow → desktop nav collapses to a working **hamburger** (never a no-nav dead zone).

## 2. Buyer portal (buyer)
- [ ] `/portal` → eyebrow StatCards; **"NGN 24,500,000" fully visible (no clipping)**; sidebar shows
      "Acme Realty" with **no clipped tagline**.
- [ ] `/portal/payments` → all currency values fully visible; **"View marketer profile" on one line**.
- [ ] `/portal/profile`, `/portal/kyc`, `/portal/saved`, `/portal/documents` → render, no errors,
      no clipped numbers/buttons.

## 3. Admin (tenant admin)
- [ ] `/admin` (Deal Board) → renders; onboarding checklist fine; strong contrast.
- [ ] `/admin/payments` → StatCards, full currency, no clipping.
- [ ] **`/admin/billing` → NO commission / "commission earned" / platform-revenue anywhere** (scroll the
      whole page). Only plan/subscription/payout data. Subtitle says "billing access for this company".
- [ ] `/admin/contracts` → renders **without crashing**; with settings unconfigured shows a clear
      "configure contract settings" notice (no runtime error). Configure under Settings → Contracts to enable.
- [ ] `/admin/listings`, `/admin/clients`, `/admin/transactions` → render, cards consistent, no clipping/wrapping.

## 4. Superadmin
- [ ] `/superadmin` → overview StatCards, no clipping.
- [ ] `/superadmin/companies` and a company detail → render; metrics not clipped.
- [ ] `/superadmin/revenue` → render; currency not clipped.
- [ ] **Commission IS visible (view-only) to superadmin** in the billing/revenue views (confirm the
      platform commission rate + commission earned appear for superadmin but NOT for the tenant admin in §3).

## 5. Cross-cutting (check on a few screens)
- [ ] **Motion**: page entrance is fast/crisp (no slow washed-out fade); button hover/press feels instant.
- [ ] **Reduced motion**: with OS "reduce motion" on, animations are effectively off.
- [ ] **Responsiveness**: mobile (~390px), tablet (~768px), desktop (~1440px) — cards reflow, dashboard
      hamburger works, nothing clips or overflows.
- [ ] **No clipped numbers / no wrapped buttons** anywhere you click.
- [ ] **Focus states**: tab through buttons/links → visible focus ring.
- [ ] **Cards**: hairline border + subtle shadow (not heavy), consistent heights in a row.

## 6. Functional commits (the non-UI work on this branch)
- [ ] Commission: hidden for admin (§3), visible view-only for superadmin (§4).
- [ ] Contract: graceful when unconfigured (§3); generates when settings are configured.
- [ ] Clerk resilience: block `clerk.accounts.dev` (DevTools → Network → block) and reload a dev page →
      page still renders (no full-page crash).
- [ ] (If Upstash on) Rate limiting: hammer a mutation past its limit → HTTP 429 with Retry-After.

## 7. Sign-off / merge criteria
- [ ] `npm run check` (test + typecheck + lint + build) green locally.
- [ ] Every box above passes (or issues logged for a follow-up).
- [ ] No regressions vs `main` on the screens reviewed.
- [ ] Then: merge `feat/design-system-v2` → `main`, deploy, and run the production migration
      reconciliation runbook if any migration work ships with it.

---

## After merge — screen-by-screen rollout (same Linear/Apple language)
Priority order for the next polish PRs (one screen/area per PR, preview-reviewed):
1. Admin: Listings, Clients, Transactions, Pipeline
2. Admin: Settings (branding/contracts), Team, Marketers
3. Portal: Profile, KYC, Documents, Contracts
4. Superadmin: Companies, Revenue, Activity
5. Marketing/platform: full pages (Properties, Features, Pricing, Insights)
6. Motion pass: subtle, consistent micro-interactions + a few tasteful transitions (reduced-motion safe)
