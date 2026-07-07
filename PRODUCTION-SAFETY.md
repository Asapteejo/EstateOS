# Production Safety — migrations & deploy

## What broke (2026-07 incident)
Production threw:
```
PrismaClientKnownRequestError: The column `SiteSettings.draftSiteContent`
does not exist in the current database. (code P2022)
```
Root cause: **schema drift**. The site-content CMS code (which reads
`SiteSettings.draftSiteContent` / `publishedSiteContent`) was deployed, but the
migration that adds those columns — `prisma/migrations/0042_site_content_cms` —
was never applied to the production database. Migrations `0042`–`0049` were all
missing in prod while the app code expected them.

Why local/dev never caught it: `postinstall` runs `prisma generate`, so the
Prisma **client types** always match the schema (build + typecheck pass). But
nothing applies the migrations to the **database**. Dev already had the columns,
so every page rendered fine locally. Only production (un-migrated) failed.

## Immediate fix (run once against production)
```
DATABASE_URL="<production url>" DIRECT_URL="<production direct url>" \
  npm run db:migrate:deploy
```
`prisma migrate deploy` applies every pending migration and never resets data.
Then redeploy (or just reload) — the error clears.

## Permanent prevention
The build is intentionally DB-free (`scripts/run-build.mjs`), so migrations must
run in a **release step**, before the new app code serves traffic:

1. **Apply migrations on every deploy.** In your release pipeline (GitHub Action,
   Vercel deploy hook, or a manual release runbook), run against the prod DB
   BEFORE promoting the new build:
   ```
   npm run db:migrate:deploy
   ```
2. **Guard against drift.** New scripts added:
   - `npm run db:migrate:status`  → shows pending migrations for the target DB.
   - `npm run db:migrate:check`   → exits non-zero if the DB is behind
     (`scripts/check-migrations.mjs`). Wire this as a pre-promote gate so a deploy
     that would drift is blocked instead of shipping.

   Recommended release order:
   ```
   npm ci
   DATABASE_URL=$PROD_DB npm run db:migrate:deploy   # apply schema
   DATABASE_URL=$PROD_DB npm run db:migrate:check     # verify no drift (fails build if behind)
   # then promote the new app build
   ```
3. **Rule of thumb:** any PR that adds a file under `prisma/migrations/` MUST be
   accompanied by a `migrate deploy` in the release for the environment it targets.

## E2E sweep result (local dev, this session)
Swept 55 routes with the dev session across roles (admin: 39, buyer portal: 16)
plus all four role logins (admin / finance / front-desk / marketer). Every real
route returned HTTP 200 with **no** Prisma / server-render errors; the only
non-200s were expected 404s on non-existent index routes and guard redirects.
This confirms the code is consistent with the current (migrated) schema — the
production failure was purely the un-applied migration, which a local sweep
cannot reproduce because dev is already migrated. The durable safeguard is the
migrate-on-deploy + drift-check above, not more local testing.

## Post-deploy smoke checklist (after any deploy with new migrations)
- `npm run db:migrate:status` against prod shows "up to date".
- Load a tenant public homepage, `/about`, `/contact`, `/careers`.
- Load `/admin` (overview), `/admin/settings/site-content`, `/portal`.
- Watch logs for `P2022` / "does not exist in the current database".
