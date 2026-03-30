# EstateOS

EstateOS is a multi-tenant real estate SaaS foundation built for three surfaces:

- Public marketing and listings
- Buyer transaction portal
- Internal admin operations

The current routing model now separates four distinct surfaces:

- `/platform`
  EstateOS SaaS marketing site for the platform itself
- `/superadmin`
  EstateOS platform-owner dashboard for `SUPER_ADMIN`
- `/admin`
  tenant/company operations for a single real estate company
- tenant public marketing and property routes such as `/properties`
  public company-facing discovery experience scoped to one tenant

## Tenant Staff Directory And Buyer Guidance

EstateOS now supports tenant-managed marketer profiles using the company-owned `TeamMember` domain.

- tenant admins manage staff and marketer profiles under `/admin/team`
- profiles are tenant-scoped and only visible to buyers/public pages when both `isActive` and `isPublished` are true
- staff profile fields now support:
  full name
  title
  photo URL
  bio
  staff code
  office location
  profile highlights
  WhatsApp number
  email
  optional resume document link
  portfolio text and links
  social links
  specialties
- public tenant directory now lives under `/team`
- optional public profile detail pages now live under `/team/[slug]`
- public contact actions render only when valid data exists:
  `mailto:` for email
  `https://wa.me/...` for WhatsApp
- tenant admins can generate branded staff ID cards from `/admin/team`
- ID cards are render-first HTML downloads and include:
  company logo
  company name and address
  staff name and role
  profile photo
  contact details
  staff code
  QR code to the tenant public site
- QR destination rules are:
  custom domain when configured
  otherwise tenant public route fallback under `/properties`
- buyers can optionally select a marketer during reservation flow
- selected marketer is persisted on reservation, transaction, and payment records where applicable
- tenant admins can see marketer attribution in payment and transaction views

The codebase is designed for one-company MVP usage today and SaaS-style tenant isolation from day one.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Clerk
- Paystack
- Cloudflare R2
- Inngest
- Upstash Redis
- Resend
- Sentry

## Architecture Summary

- `Company` is the tenant root in [prisma/schema.prisma](c:/Users/HP/Desktop/Realestate%20saas/prisma/schema.prisma).
- Tenant-owned records carry `companyId` and are queried through server-side tenant helpers.
- Public marketing, buyer portal, and admin dashboard are split into route groups under [src/app](c:/Users/HP/Desktop/Realestate%20saas/src/app).
- Business reads and writes are concentrated in module services under [src/modules](c:/Users/HP/Desktop/Realestate%20saas/src/modules).
- Server runtime configuration is validated centrally in [src/lib/config.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/config.ts), [src/lib/env.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/env.ts), and [src/lib/public-env.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/public-env.ts).

## Tenant Model Summary

- `SUPER_ADMIN` can operate across tenants.
- Non-super-admin users are restricted to one resolved tenant.
- `SUPER_ADMIN` platform routes live under `/superadmin` and are intentionally separate from tenant admin routes under `/admin`.
- Tenant resolution currently supports:
  session-based app usage
  public fallback via `DEFAULT_COMPANY_SLUG`
  future subdomain/custom-domain routing
- Tenant-owned reads should use:
  `requireTenantContext`
  `requirePublicTenantContext`
  `findManyForTenant`
  `findFirstForTenant`
  `countForTenant`
  `aggregateForTenant`
- Privileged writes reject caller-supplied `companyId`.
- Private document access requires tenant match plus ownership or staff entitlement.
- Payment references and storage keys are tenant-namespaced before leaving the app.
- Public staff directory reads return only active + published `TeamMember` rows for the resolved tenant.
- Staff ID-card generation is admin-only and uses the requesting tenant context before loading branding or profile data.

## Billing And Monetization Model

EstateOS now uses a hybrid SaaS monetization model:

- company subscription plans with explicit monthly and annual intervals
- superadmin manual grants and overrides
- transaction-level platform commission on successful property payments
- provider-aware split settlement design so tenant proceeds and EstateOS commission can be separated cleanly

Implemented billing domain records now include:

- `Plan`
- `CompanySubscription`
- `CompanyBillingSettings`
- `CompanyPaymentProviderAccount`
- `CommissionRule`
- `CommissionRecord`
- `SplitSettlement`
- `BillingEvent`

Business rules enforced in code:

- every company can have a current plan
- plans can be monthly, annual, or manually granted
- superadmin grants do not exempt the company from transaction commission
- transaction commission is created from webhook-authoritative successful payments
- transaction access flows are gated by active company plan status
- public marketing and listing reads remain publicly accessible

### Monthly vs Annual Rules

- Monthly and annual plans are separate plan records with explicit `interval`
- active access is determined from `status`, `isCurrent`, `startsAt`, `endsAt`, and `cancelledAt`
- annual plans are modeled directly, not inferred from monthly price multipliers
- subscription checkout architecture is provider-ready, but live recurring billing is not yet wired in this workspace

### Superadmin Grants

- only `SUPER_ADMIN` can create plans, assign plans, grant plans, and revoke current subscriptions
- grant actions require a reason
- grant and revoke actions are written to both billing events and audit logs
- granted tenants still generate platform commission records on successful transaction payments

### Commission Model

- current implementation supports flat per-transaction commission rules
- percentage rules are modeled in the schema and commission logic
- every successful webhook-reconciled payment can upsert:
  - `CommissionRecord`
  - `SplitSettlement`
  - receipt state
  - audit event
- reporting foundations now support:
  - active subscriptions
  - granted plans
  - expired subscriptions
  - platform commission earned
  - subscription revenue visibility
  - payout readiness issues

### Split Payment Model

- settlement calculation is centralized in the billing module
- company payout readiness is derived from `CompanyPaymentProviderAccount`
- provider-specific split payloads are isolated from unrelated app logic
- current live checkout path remains Paystack-first for property transaction payments
- architecture already supports future Stripe / Flutterwave style settlement strategies through provider-specific metadata builders

### International Provider Readiness

- billing and payment domain records are currency-aware
- transaction provider and subscription provider are stored separately in `CompanyBillingSettings`
- provider account configuration is modeled independently from payment records
- local and international providers can coexist without hardcoding one provider across the whole billing stack
- only Paystack property-payment initialization is live in this workspace today; Stripe/Flutterwave readiness is structural, not falsely claimed as live

## Environment Model

Environment parsing is centralized and typed.

- Server env: [src/lib/env.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/env.ts)
- Public client env: [src/lib/public-env.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/public-env.ts)
- Shared schemas and feature-flag derivation: [src/lib/config.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/config.ts)

The app now validates aggressively when:

- a service group is only partially configured
- public config is malformed

Production-critical services are reported through startup logs and `/api/readyz`. This keeps `next build` reproducible in CI and local environments while still making misconfigured production runtime fail operational checks immediately.

### Required In Production

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `APP_BASE_URL`
- `DEFAULT_COMPANY_SLUG`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

### Optional But Supported

- `R2_PUBLIC_BASE_URL`
- `MAPBOX_ACCESS_TOKEN`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_BASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SENTRY_DSN`

### Service Group Rule

Partial configuration is treated as invalid for grouped services. For example, setting only `PAYSTACK_SECRET_KEY` without the webhook secret now fails config parsing.

## Local Developer Bootstrap Checklist

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Start PostgreSQL.
4. Set at least:
   `DATABASE_URL`
   `NEXT_PUBLIC_APP_URL`
   `APP_BASE_URL`
   `DEFAULT_COMPANY_SLUG`
5. Run Prisma validate and generate.
6. Run migrations.
7. Seed demo data.
8. Start the dev server.
9. Open `/api/health` and `/api/readyz`.

## Local Setup

### 1. Install

```bash
npm install
```

### 2. Configure Env

```bash
copy .env.example .env.local
```

Minimum local env for DB-backed development:

```env
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_BASE_URL="http://localhost:3000"
DEFAULT_COMPANY_SLUG="acme-realty"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/realestate_platform?schema=public"
```

Prisma CLI commands load `.env.local` first and then `.env` through [prisma.config.ts](c:/Users/HP/Desktop/Realestate%20saas/prisma.config.ts), so the same local database config can be reused across Next.js and Prisma workflows.

If Clerk is not configured in non-production, local demo mode remains available for `/portal` and `/admin`.

### 3. Start PostgreSQL

Option A: local PostgreSQL

```sql
CREATE DATABASE realestate_platform;
```

Option B: Docker

```bash
docker run --name realestate-postgres ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=realestate_platform ^
  -p 5432:5432 ^
  -d postgres:16
```

### 4. Prepare Prisma

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 5. Run The App

```bash
npm run dev
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run check`
- `npm run db:validate`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:migrate:deploy`
- `npm run db:seed`

## Database And Migration Workflow

### Local Development

Use:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Production / Staging

Use:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
```

Notes:

- `prisma migrate dev` is for local development only.
- `prisma migrate deploy` is the production-safe path.
- Seed data is deterministic and intended for development/demo environments.
- The schema and baseline migration should stay aligned; run `npx prisma validate` and `npx prisma generate` after schema changes.

## Auth, Session, And Tenancy Runtime Rules

- Clerk is required in production.
- In non-production, EstateOS exposes explicit demo access for `/portal`, `/admin`, and `/superadmin` even if Clerk is configured but no user is signed in.
- Development mode now shows a small role switcher so you can jump between public, buyer, tenant admin, and superadmin surfaces without weakening production auth rules.
- Public tenant rendering currently resolves through:
  `DEFAULT_COMPANY_SLUG`
  future host/subdomain lookup
  authenticated session context when applicable
- Clerk webhook sync now validates referenced `companyId` and `branchId` against the database before persisting them.
- Middleware protects `/portal`, `/admin`, and `/superadmin` only in production when Clerk is configured.

## Platform Owner Vs Tenant Admin

- `SUPER_ADMIN`
  sees cross-company subscription, billing, payout-readiness, payment, and audit visibility through `/superadmin`
- tenant `ADMIN`
  sees only company-scoped operational data through `/admin`
- buyer users continue to operate through `/portal`
- the default platform entry is `/`, which routes into the EstateOS SaaS marketing experience
- `/platform` remains a stable alias for the EstateOS SaaS marketing site
- tenant public property experiences remain separate and continue to resolve through the active/public tenant context

## Payment Authority Model

Paystack is intentionally split into two paths:

- `POST /api/payments/initialize`
  initializes provider payment and may persist a pending local payment row
- `POST /api/payments/verify`
  is a read/check helper only and does not mutate authoritative finance state
- `POST /api/webhooks/paystack`
  is the source of truth for reconciliation

Webhook reconciliation currently handles:

- tenant resolution from namespaced reference
- idempotency guard via provider event identity
- payment upsert/update
- transaction and installment linkage
- receipt upsert
- receipt document persistence
- commission record upsert
- split settlement upsert
- transaction balance update
- transaction stage/milestone update
- audit log write

### Buyer Payment Progress

Buyer payment transparency now renders from persisted database state:

- total payable amount
- amount paid so far
- outstanding balance
- installment schedule
- selected payment plan
- selected marketer
- receipt access

This is current-state rendering, not websocket-based realtime.

### Inquiry Workflow

- Public visitors can submit tenant-scoped property or general inquiries through `/api/inquiries`.
- Authenticated buyers can submit the same inquiry flow from inside the portal dashboard.
- Inquiry lifecycle now supports:
  `NEW`
  `CONTACTED`
  `INSPECTION_BOOKED`
  `QUALIFIED`
  `CONVERTED`
  `CLOSED`
  `LOST`
- Tenant admins manage inquiries from `/admin/leads`, including status changes, assignable staff routing, and internal notes.

### Inspection Workflow

- Public property pages can submit inspection requests through `/api/inspections`.
- Inspection bookings are persisted and tenant-scoped.
- Inspection lifecycle now supports:
  `REQUESTED`
  `CONFIRMED`
  `RESCHEDULED`
  `COMPLETED`
  `CANCELLED`
  `NO_SHOW`
- Tenant admins manage bookings from `/admin/bookings`.
- Buyers can review persisted booking state from `/portal/inspections`.

### Notification Behavior

- In-app notifications remain the required channel.
- This pass adds practical coverage for:
  inquiry received
  inquiry assigned
  inspection requested
  inspection updated
  reservation created
  transaction stage updates
  payment and receipt visibility
- Email uses the current Resend foundation when configured; otherwise notification records still persist and email falls back to demo behavior.
- Superadmin notifications remain separate from tenant notification streams.

### Sales Pipeline Behavior

- Tenant admins now have a dedicated `/admin/pipeline` view.
- The pipeline summarizes:
  leads / inquiries
  inspections
  reservations
  payments in progress
  completed deals
- Cards are drill-down oriented and link back to the operational lists for leads, bookings, transactions, and payments.

### Purchase Installment Configuration

Tenant admins can now configure purchase payment plans on properties with:

- `ONE_TIME`
- `FIXED`
- `CUSTOM`

Each plan can define:

- property- or unit-level scope
- title
- duration
- installment count
- deposit percent
- down payment amount
- schedule description
- active state
- installment rows with amount and due offsets

This is purchase-plan modeling only. It does not claim live recurring provider billing for buyer installments.

Transaction payment initialization now also:

- checks active company plan access for transaction flows
- resolves the tenant commission rule
- verifies payout/split readiness for the configured transaction provider
- attaches provider-specific split metadata only through the billing settlement service

## Storage Model

### Public Brochures

- Public brochure route: `/brochures/[slug]`
- Only documents with `documentType = BROCHURE` and `visibility = PUBLIC` are eligible
- Public brochure delivery is separate from private document vault access
- Route-handler redirects now always resolve through `new URL(target, request.url)` semantics so internal brochure fallbacks do not throw malformed URL errors
- If no public brochure asset URL can be resolved, the route falls back safely to the internal `/brochure` page without exposing private document paths

### Private Documents

- Buyer/admin private download route: `/api/documents/[documentId]/download`
- Buyer/admin private receipt render route: `/api/receipts/[receiptId]/download`
- Access requires tenant match and ownership/staff entitlement
- Upload signing uses tenant-namespaced keys
- Missing R2 config falls back safely in non-production flows instead of exposing internals

### Branded Receipt Behavior

- receipts are rendered with tenant company branding and company contact data
- buyer access remains ownership-safe
- tenant admins can also view tenant receipts
- current implementation is a private render-first receipt download pipeline
- it does not pretend background PDF generation or email delivery is live unless separately configured

## Health And Readiness Endpoints

- `/api/health`
  basic liveness plus non-secret dependency summary and runtime readiness summary
- `/api/readyz`
  readiness endpoint with DB connectivity status, production-readiness checks, and safe dependency summary

These endpoints do not expose secrets.

## Observability And Error Handling

- Sentry initialization is wired through [instrumentation.ts](c:/Users/HP/Desktop/Realestate%20saas/instrumentation.ts) and [src/lib/sentry.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/sentry.ts)
- Root UI errors are captured in [src/app/error.tsx](c:/Users/HP/Desktop/Realestate%20saas/src/app/error.tsx)
- Critical webhook failures now emit safe logs and error capture
- Startup readiness is logged once through [src/lib/ops/startup.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/ops/startup.ts)

## Deployment Readiness

The repo is prepared for Next.js production deployment and includes [vercel.json](c:/Users/HP/Desktop/Realestate%20saas/vercel.json) for a straightforward Vercel setup.

### Production Checklist

1. Provision PostgreSQL.
2. Set all required production env vars.
3. Configure Clerk frontend and backend keys plus webhook URL.
4. Configure Paystack callback and webhook URLs.
5. Configure R2 bucket and credentials.
6. Run:
   `npm run db:validate`
   `npm run db:generate`
   `npm run db:migrate:deploy`
7. Deploy the app.
8. Verify:
   `/api/health`
   `/api/readyz`
   Clerk auth flow
   Paystack webhook flow
   brochure download flow
   private document flow
9. Confirm `/api/readyz` reports `ok: true` before exposing the environment to internal users.

### Mandatory Services For First Production Deployment

- PostgreSQL
- Clerk
- Paystack
- Cloudflare R2

### Mandatory Services For Hybrid Monetization In Production

- billing plans seeded or created by superadmin
- at least one active `CommissionRule`
- `CompanyBillingSettings` for each live tenant
- active payout configuration in `CompanyPaymentProviderAccount`
- Paystack webhook delivery for authoritative transaction commission creation

### Services That Can Be Disabled In Lower Environments

- Mapbox
- Resend
- Upstash Redis
- Inngest
- Sentry

## Runtime Verification In This Workspace

Verified here:

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`

Billing-specific runtime confidence added here:

- active plan calculation
- granted-plan behavior
- commission-on-granted-plan behavior
- split-settlement preview generation
- billing plan and manual grant validation rules

Build verification in this workspace now runs without requiring live production secrets at import time. Production readiness is surfaced through runtime checks instead of blocking `next build`.

## What Still Requires Live Credentials Or Infrastructure

- Real Postgres migrate/seed execution against a running database
- Real Clerk auth and webhook round-trips
- Real Paystack initialize/verify/webhook round-trips
- Real R2 object upload/download behavior
- Real Resend delivery
- Real Upstash, Inngest, and Sentry behavior in staging/production
- Real subscription checkout / renewal provider flow for monthly and annual SaaS billing
- Real provider payout account provisioning for Paystack split settlement and future international providers

## Development-Ready Status

EstateOS is now development-ready in the following sense:

- env parsing is typed and centralized
- local bootstrap is explicit and reproducible
- Prisma workflow has local and production-safe script paths
- health and readiness endpoints exist
- client/server config boundaries are cleaner
- production-only missing-core-service states are surfaced through runtime readiness checks and startup logs

## Platform Marketing Site

EstateOS now has a dedicated SaaS marketing surface under `/platform` with:

- Home
- Features
- How it works
- Pricing
- Why EstateOS
- FAQ
- Contact / demo request

This site is intentionally separate from tenant public property routes so the SaaS product story does not get mixed with a tenant company's listing website.

## Current Expansion Pass Status

Implemented in the current pass:

- brochure redirect bug fix for route-handler-safe absolute redirects
- dedicated `SUPER_ADMIN` platform dashboard and company oversight views
- public EstateOS SaaS marketing site under `/platform`

Still follow-up work:

- deeper superadmin action surfaces beyond inspection and navigation
- tenant-aware custom-domain routing for platform-vs-tenant host separation
- richer platform marketing lead capture and CRM handoff for the EstateOS SaaS site
- richer marketer profile media and resume upload UX
- provider-side recurring buyer installment collection is still follow-up work

## Known Remaining Risks

- Live external-service behavior is still unproven until real staging credentials are used
- Demo fallbacks remain intentionally available in non-production, so teams need discipline not to confuse demo behavior with live integrations
- Sentry wiring is basic and should be expanded with richer tracing and release configuration before high-volume production use
- Receipt documents are persisted, but receipt PDF generation is still deferred
- Subscription checkout, renewal charging, and dunning are provider-ready in schema/service design but not live yet
