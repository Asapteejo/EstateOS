# Incident — P2022 "column does not exist" in production (2026-09-15)

## What users saw

Server errors on pages that read tenant site content:

```
PrismaClientKnownRequestError: The column `SiteSettings.draftSiteContent`
does not exist in the current database.
code: 'P2022'
```

## Root cause (two layers)

**1. The database was behind the deployed code.**
`draftSiteContent` / `publishedSiteContent` are added by migration
`0042_site_content_cms`. That migration is in the repo but was never applied
to the production database, so the deployed code queried columns that do not
exist.

**2. The safety net was blind — this is the real bug.**
`/api/readyz` already compares applied migrations against an expected list.
That list (`EXPECTED_PRODUCTION_MIGRATIONS`) was **hand-maintained and stopped
at `0035`**, while the repo had grown to `0049`. Production therefore reported:

```json
"migrations": { "ok": true, "missing": [] }
```

a **false green**, while 14 migrations — including 0042 — were missing. The
monitoring said healthy right up until users hit the broken pages.

## Immediate fix (operator action)

```bash
# 1. See exactly what is missing
npx prisma migrate status          # with DATABASE_URL pointed at production

# 2. Apply the pending migrations
npm run db:migrate:deploy

# 3. Confirm the gap is closed — `missing` must be []
curl -s https://estateos.tech/api/readyz | jq '.checks.database.migrations'
```

Expect several migrations to apply, not just 0042. `0049_webhook_event_dedup_unique`
deletes duplicate historical `WebhookEvent` rows before adding its unique index;
it is additive and safe, but read it before running if the table is large.

## Prevention shipped with this change

| Layer | What it does |
|---|---|
| **Generated manifest** | `scripts/generate-migration-manifest.mjs` derives the expected-migrations list from `prisma/migrations/`. A hand-maintained list can go stale; a generated one cannot. |
| **Build step** | `run-build.mjs` regenerates the manifest before `next build`, so every deploy ships a current list. |
| **CI guard** | `npm run migrations:check` fails the build when a migration was added without regenerating the manifest. |
| **Graceful degradation** | `getTenantSiteContentState` catches the read failure. The site-content editor shows an explanatory banner instead of a 500; the public site was already falling back to default copy. |
| **E2E browser sweep** | Playwright loads every public / admin / portal route and fails on any 5xx, error boundary, or console error. |
| **Health gate** | `e2e/health.spec.ts` asserts `migrations.missing === []`. Run it against a deployment right after release. |

## Running the E2E suite

```bash
npm install                 # first time — installs @playwright/test
npm run e2e:install         # first time — downloads the browser

npm run e2e                 # full sweep against a local dev server
npm run e2e:ui              # interactive runner

# Against a deployed environment (no local server is started):
E2E_BASE_URL=https://estateos.tech npm run e2e:health
```

The authenticated sweep signs in through `/api/dev/session`, which only mints
a session when `ESTATEOS_ENABLE_DEV_BYPASS` is on and the database is not
production. Against production those tests **skip themselves** rather than
fail, so `e2e:health` is the production-safe subset.

## Post-deploy check (add to the release runbook)

```bash
E2E_BASE_URL=https://estateos.tech npm run e2e:health
```

Green means the database matches the deployed code. Red names the exact
missing migrations.

## Separate findings from this investigation

- **`R2_PUBLIC_BASE_URL` is not configured in production.** `/api/readyz`
  warns about it. Consequence: public assets use the signed-proxy fallback,
  and because the `next/image` host allowlist is derived from this variable at
  **build time**, property photos are not being optimised in production. Set
  it in the build environment and redeploy to activate AVIF/WebP.
- **Sentry is disabled in production** (`sentry: "disabled"`). This incident
  was found by a user, not by alerting. Enabling `SENTRY_DSN` would have
  surfaced the P2022 on the first occurrence.
