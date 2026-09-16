# Deploy pipeline — apply migrations + block drift

Wire these so the `SiteSettings.draftSiteContent` class of error (schema drift)
can never ship again. The build stays DB-free; migrations run in a release step.

## Option A — GitHub Actions (recommended if you deploy from GitHub)

Create `.github/workflows/deploy-migrate.yml`:

```yaml
name: DB migrate + drift gate
on:
  push:
    branches: [main]          # or your production branch
  workflow_dispatch:

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production     # holds the production DB secrets
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      # 1) apply any pending migrations to the production DB
      - run: npm run db:migrate:deploy
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.PROD_DIRECT_URL }}
      # 2) fail the job if the DB is still behind (defense in depth)
      - run: npm run db:migrate:check
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.PROD_DIRECT_URL }}
```

Make the Vercel production deploy **depend on this job succeeding** (e.g. trigger
Vercel via a deploy hook only after this workflow passes, or run the app deploy
as a later step in the same workflow). The point: migrations land BEFORE the new
code serves traffic.

## Option B — Vercel only (no GitHub Actions)

Vercel builds must not touch the DB, so add a **release step** you run before
promoting a build (locally or from a small CI job) with the prod connection:

```
DATABASE_URL="$PROD_DB" DIRECT_URL="$PROD_DIRECT" npm run db:migrate:deploy
DATABASE_URL="$PROD_DB" DIRECT_URL="$PROD_DIRECT" npm run db:migrate:check   # exits 1 if behind
```

Then promote the Vercel deployment. Do NOT put `migrate deploy` in the Vercel
build command — the build has no guaranteed DB access and that's by design
(`scripts/run-build.mjs`).

## The one rule
Any PR that adds a file under `prisma/migrations/` must be paired with a
`db:migrate:deploy` in the release for the environment it targets. `db:migrate:check`
is the gate that enforces it.
