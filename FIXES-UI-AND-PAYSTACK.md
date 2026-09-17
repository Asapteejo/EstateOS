# Three fixes — company name clipping, superadmin leakage, Paystack

## 1. Company name cut off in the dashboard sidebar — FIXED (code)
`src/components/shared/logo.tsx` had `sm:min-w-[11rem]` on the name wrapper. That
hard 176px minimum is wider than the sidebar's inner card, so long names like
"Blueprint Urban Residences LTD" overflowed and were clipped by the parent's
`overflow-hidden`. Removed the min-width, kept `min-w-0` so the flex child can
shrink, and added `break-words` so the full name wraps instead of being cut.

## 2. Superadmin-only content on the tenant admin dashboard — FIXED (code)
Two separate leaks:

**a) "Paystack platform readiness" card** (`owner: "Platform"`, links to
`/superadmin/settings`). The readiness checklist mixed tenant-owned and
platform-owned items and rendered the whole list to tenant admins.
- `src/components/shared/tenant-readiness-checklist.tsx`: added an `audience`
  prop. `audience="tenant"` filters out any item owned by **Platform** or
  **Superadmin**, or whose action link points at `/superadmin/*`.
- `src/app/(admin)/admin/settings/page.tsx` now passes `audience="tenant"`.
- The superadmin company page still sees the full list (default audience).
This also removes the other platform-owned rows (R2 storage, public-site
reachability) from the tenant view — a tenant can't action those either.

**b) "This account cannot access the platform owner dashboard"**
(`src/app/app/access/page.tsx`, `?status=forbidden`). This page is what an
ordinary tenant admin sees if they land on a `/superadmin` URL. The guard was
correct, but the page was alarming and wrong: its "what this means" bullets are
hardcoded SUSPENSION copy ("Admin dashboards, portal access, and payment actions
are currently blocked") — untrue for this case, nothing is blocked.
- The `forbidden` case now has its own reassuring bullets ("Your company
  workspace is unaffected…") and its button goes to **/admin** ("Go to your
  dashboard") instead of the marketing homepage.

NOTE: nothing is being *exposed* here — the superadmin guard works, it just
explained itself badly. If a tenant admin is hitting this page repeatedly,
something is linking them to /superadmin; tell me where you clicked from and
I'll remove that link.

## 3. Paystack not working — CONFIG, not code
`src/modules/readiness/service.ts` sets `paystackConfigured: featureFlags.hasPaystack`,
and in `src/lib/config.ts`:

```
hasPaystack = PAYSTACK_SECRET_KEY && PAYSTACK_PUBLIC_KEY && PAYSTACK_WEBHOOK_SECRET
```

All **three** must be present. So "MISSING" = at least one is not set in the
**Vercel production** environment. Two gotchas:
- `normalizeRuntimeServerEnv()` **clears the entire group** if only some are set —
  a partial config reads as completely missing.
- `getProductionReadinessIssues()` also flags it if `PAYSTACK_WEBHOOK_SECRET`
  looks like a URL: it must be the **signing secret**, not the webhook URL.

### To fix
In Vercel → Project → Settings → Environment Variables (**Production**), set all three:
- `PAYSTACK_SECRET_KEY`   → `sk_live_…`
- `PAYSTACK_PUBLIC_KEY`   → `pk_live_…`
- `PAYSTACK_WEBHOOK_SECRET` → the signing secret from the Paystack dashboard
  (Settings → API Keys & Webhooks), **not** the webhook URL.

Then **redeploy** (env changes need a new build). The card flips to complete.
Separately, each tenant still connects their own Paystack **subaccount** under
Admin → Settings ("Payment account" item) so buyer payments settle to them.
