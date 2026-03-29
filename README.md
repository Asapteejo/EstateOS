# Acme Realty Platform Foundation

Production-minded Phase 1 foundation for a modern real estate platform built with:

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style component foundation
- PostgreSQL + Prisma
- Clerk auth integration
- Cloudflare R2 upload foundation
- Paystack payment foundation
- Mapbox-ready property mapping
- Inngest event/job foundation
- Upstash Redis rate limiting
- Resend email foundation
- Sentry-ready monitoring hooks
- Vercel-ready deployment shape

## Multi-Tenancy

This codebase is now structured as a tenant-safe SaaS foundation from day one.

- `Company` is the tenant root model in [prisma/schema.prisma](c:/Users/HP/Desktop/Realestate%20saas/prisma/schema.prisma)
- Core operational entities carry `companyId` and are indexed for tenant-scoped access
- Roles are tenant-scoped through `Role.companyId` and `UserRole.companyId`
- `SUPER_ADMIN` remains globally elevated and may operate across tenants
- Non-super-admin access is constrained to one tenant context
- Tenant resolution is prepared for domain, subdomain, and current-session-based lookup in [src/lib/tenancy/context.ts](c:/Users/HP/Desktop/Realestate%20saas/src/lib/tenancy/context.ts)
- Seed data creates a default tenant and attaches all demo content to it

Final tenant isolation rules:

- Tenant-owned reads must resolve tenant context server-side and scope by `companyId` unless the actor has `SUPER_ADMIN`
- Client-supplied `companyId` is rejected on write routes
- Payment references are tenant-namespaced before provider initialization
- Upload keys are tenant-namespaced before storage signing
- Private document access must satisfy both tenant match and ownership or staff entitlement
- Public marketing writes must resolve a tenant from domain, subdomain, or server-configured default tenant context
- Dashboard KPIs and future aggregates must use tenant-scoped helpers in `src/lib/tenancy/db.ts`
- Live DB-backed screens must load tenant-owned rows through centralized query services, not route-local raw Prisma reads
- Buyer portal reads must satisfy both tenant scope and buyer ownership where the record is user-bound
- Aggregate queries must stay tenant-scoped at the root query level before any sum, count, or ranking logic is applied
- Nested relation data rendered on tenant-owned screens must be treated as untrusted until the related row also matches tenant expectations
- Public CMS content must resolve tenant context first, then read only that tenant's published rows so future custom domains and subdomains render isolated brand content
- Query-service rule:
  route handlers and pages should call module-level query services; tenant-owned Prisma reads should not be written ad hoc in UI files

## What Is Included

- Premium marketing site:
  Home, About, Listings, Property detail, Agents, Testimonials, Contact, FAQ, Blog, Careers scaffold
- Buyer portal:
  Dashboard, Profile, KYC, Saved properties, Reservations, Payments, Timeline, Notifications, Documents, Support scaffold
- Admin dashboard:
  Overview, Listings, Leads, Bookings, Clients, Transactions, Payments, Documents, Notifications scaffold, Analytics scaffold, Audit logs
- Backend foundations:
  Prisma schema, generated migration SQL, seed script, route protection, validated APIs, payment abstraction, upload abstraction, event publishing, Clerk webhook sync, audit logging

## Architecture

Key folders:

- `src/app`: marketing, portal, admin, and API routes
- `src/components`: shared, marketing, portal, and UI primitives
- `src/lib`: auth, db, payments, storage, notifications, audit, cache, validations, utils
- `src/lib/tenancy`: tenant resolution, scoping, and guard helpers
- `src/modules/admin/queries.ts`: tenant-safe admin read services
- `src/modules/portal/queries.ts`: tenant-safe buyer read services
- `src/modules`: seeded demo domain data by module
- `prisma`: schema, migration, seed
- `src/inngest`: background function definitions

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in required service credentials.
3. Start PostgreSQL and point `DATABASE_URL` at it.
4. Install dependencies:

```bash
npm install
```

5. Generate Prisma client:

```bash
npm run db:generate
```

6. Apply migrations against your database:

```bash
npm run db:migrate
```

7. Seed demo data:

```bash
npm run db:seed
```

8. Run locally:

```bash
npm run dev
```

## Local Postgres Bootstrap

Option A: existing local PostgreSQL

1. Create a database:

```sql
CREATE DATABASE realestate_platform;
```

2. Set `DATABASE_URL` in `.env.local`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/realestate_platform?schema=public"
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

Then run:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Environment Notes

Required for full production behavior:

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `RESEND_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional but wired:

- `MAPBOX_ACCESS_TOKEN`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `SENTRY_DSN`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

## Demo Mode

If Clerk is not configured, the app falls back to local demo access for `/portal` and `/admin` in non-production environments so the product shell remains explorable.

If Paystack, R2, Redis, Resend, or Mapbox are not configured, their integrations fall back to safe placeholders or no-op foundations instead of crashing the app.

## Finished In Phase 1

- Modular app structure with marketing, portal, and admin sections
- Production-oriented Prisma schema across listings, CRM, transactions, documents, CMS, and system domains
- Mandatory multi-tenant architecture built into the schema and request-level access helpers
- Initial migration SQL at `prisma/migrations/0001_init/migration.sql`
- Seed script with realistic demo content
- Clerk-aware auth guards and middleware with database role model
- Tenant-aware session and request context resolution
- Validated inquiry, inspection, upload-signing, payment initialize/verify, and webhook routes
- DB-backed tenant-safe reads for admin listings, admin inquiries, admin payments, admin transactions, admin documents, buyer reservations, buyer payments, and buyer document vault
- DB-backed tenant-safe reads for admin bookings, admin clients, analytics details, buyer dashboard summary, buyer saved properties, buyer notifications, and buyer timeline
- DB-backed tenant-safe reads for admin audit logs, admin notifications, public property listings, and public property detail pages
- Public tenant-aware CMS loaders for testimonials, FAQ, team members, blog index, blog post pages, and homepage editorial sections
- Tenant-scoped admin KPI and leaderboard queries for inquiries, reservations, active deals, overdue payments, sales value, top listings, and top staff
- Paystack provider abstraction with server-side verification pattern
- Paystack webhook persistence, idempotency handling, tenant resolution from namespaced references, installment-aware reconciliation, receipt upsert, and audit logging
- Cloudflare R2 signed upload/download helpers
- Inngest event publishing and starter function
- Upstash rate limiting on inquiry intake
- Audit log service foundation
- Responsive premium UI foundation

## Intentionally Scaffolded For Phase 2

- Real interactive Mapbox rendering on property detail pages
- Full Prisma-backed admin CRUD UI mutations
- Rich CMS editing workflows
- Receipt PDF generation and downloadable asset pipeline
- Staff permission matrix beyond role-level gating
- Realtime buyer support/chat
- Full analytics charts and reporting pipeline
- Deep Sentry instrumentation files

## Verification

Verified locally in this workspace:

- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Runtime Verification Checklist

Local database bootstrapping:

1. Start PostgreSQL using either your local install or the Docker command above.
2. Copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL`.
4. Run `npm run db:generate`.
5. Run `npm run db:migrate`.
6. Run `npm run db:seed`.
7. Start the app with `npm run dev`.

Buyer flow checklist:

1. Sign up through Clerk or use demo portal access in non-production.
2. Open `/properties` and confirm listings render from Prisma for the resolved tenant.
3. Save a property from the buyer flow once the save mutation is wired or validate seeded saved-property data at `/portal/saved`.
4. Open `/portal/reservations`, `/portal/payments`, `/portal/documents`, and `/portal/timeline` and confirm seeded DB records render only for the current buyer.
5. Call `POST /api/payments/initialize` with the tenant session and confirm a pending payment row is created.
6. Deliver a signed Paystack webhook to `/api/webhooks/paystack` and confirm payment status, receipt, audit log, and buyer-facing payment/documents surfaces update.

Admin flow checklist:

1. Sign in as an admin or use demo admin access in non-production.
2. Open `/admin/listings`, `/admin/leads`, `/admin/bookings`, `/admin/clients`, `/admin/transactions`, `/admin/payments`, `/admin/documents`, `/admin/notifications`, and `/admin/audit-logs`.
3. Confirm each screen only shows tenant-owned records.
4. Confirm `/admin` and `/admin/analytics` KPIs and ranking tables stay tenant-scoped.
5. Confirm public pages at `/properties` and `/properties/[slug]` only show public property/media/brochure data, never private document records.

## Notes

- Most operational and CMS surfaces now read live tenant-scoped Prisma data through centralized query services. Remaining seeded areas are primarily scaffolds or phase-2 CRUD/mutation workflows.
- Queries that touch tenant-owned data should always flow through tenant context and `companyId` scoping. The helper entry points for that are in `src/lib/tenancy`.
- Prefer `requireTenantContext`, `requirePublicTenantContext`, `findManyForTenant`, `findFirstForTenant`, `countForTenant`, and `aggregateForTenant` over raw ad hoc tenant-owned Prisma queries.
- Payment/installment business rule:
  one installment may receive multiple payments over time, but each payment may point to only one installment. `Payment.installmentId` is nullable and additive for backward compatibility.
- Payment reconciliation flow:
  initialize route namescopes the reference, optionally persists a pending payment, and may attach `transactionId`, `reservationReference`, and `installmentId`; webhook verifies signature, resolves tenant from the namespaced reference, guards duplicate provider events, reconciles against the matching transaction and installment when metadata supports it, upserts a receipt, and records an audit log.
- Migration assumption for installment-aware payments:
  `Payment.installmentId` is additive and nullable, so existing payments remain valid while newer flows can reconcile directly to a payment plan installment.
- Runtime verification notes:
  lightweight Node tests cover tenant query scoping helpers, buyer ownership checks, document access enforcement, payment webhook idempotency key and installment semantics, public property visibility filters, and admin notifications/audit-log query rules.
- Sensitive document handling is modeled as private by default. Public brochure handling is intentionally separated from private vault access.
- Payment success is not trusted from the client. Verification and webhook routes are separated for server-side confirmation flow.
