# Production Migration Reconciliation Runbook

Goal: bring production in line with the repaired migration history without data loss
or a broken deploy. **Production uses `prisma migrate deploy`.**

## What changed in the repo (commit aaff021)
- `0004_crm_inspections_notifications` — **edited** (made idempotent; identical end schema).
  Already applied in prod, so its checksum no longer matches → must be reconciled or
  `migrate deploy` will reject it.
- `0035a_team_member_invitation_base` — **new**. Creates the `TeamMemberInvitation` table +
  `InvitationStatus` enum. The table already exists in prod (created out-of-band) → mark applied.
- `0040_drop_legacy_team_invitation_invited_by_id` — **new**. Drops the redundant
  `invitedById` column (data already lives in `invitedByUserId`). Apply via deploy.
- `0036` / `0039` — unchanged (byte-identical to committed).

---

## 0. Pre-flight (non-production)
1. Push the branch; confirm CI + `npm run build` are green.
2. On a freshly reset local DB, capture the NEW checksum Prisma computed for the edited 0004:
   ```sql
   SELECT checksum FROM "_prisma_migrations"
   WHERE migration_name = '0004_crm_inspections_notifications';
   ```
   Record it as `<LOCAL_0004_CHECKSUM>`.

## 1. Back up production
Take a full production DB snapshot/backup and confirm it is restorable.
**Do not proceed without a verified backup.**

## 2. Read-only inspection of production
```sql
SELECT migration_name, checksum, finished_at, rolled_back_at
FROM "_prisma_migrations" ORDER BY migration_name;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'TeamMemberInvitation' ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns
WHERE table_name = 'InspectionBooking' ORDER BY ordinal_position;
```
Confirm before any write:
- `0004_...` row exists with `finished_at` set and `rolled_back_at` NULL (applied & clean).
- **No** rows have `rolled_back_at` set or `finished_at` NULL (a failed/partial migration → STOP and fix that first).
- `0035a` and `0040` are absent (expected).
- `TeamMemberInvitation` exists and has `invitedByUserId`; note whether `invitedById` is still present.
- `InspectionBooking` has `userId` and `assignedStaffId` (confirms 0004 was effectively applied).

If anything is unexpected (failed migrations, missing earlier records, the new migrations
already present), **STOP and reassess** — do not write.

## 3. Reconcile the 0004 checksum
Only if step 2 shows a 0004 row that is applied:
```sql
UPDATE "_prisma_migrations"
SET checksum = '<LOCAL_0004_CHECKSUM>'
WHERE migration_name = '0004_crm_inspections_notifications';
```
(Metadata only — no schema change. If there is **no** 0004 row, skip this; `migrate deploy`
will simply run 0004, which is now idempotent and safe.)

## 4. Mark the base migration as applied (table already exists)
```bash
npx prisma migrate resolve --applied 0035a_team_member_invitation_base
```

## 5. Deploy
```bash
npx prisma migrate deploy
```
Expected: applies `0040` (and any genuinely pending migration). `0040` drops `invitedById`
if present (`DROP COLUMN IF EXISTS`).

## 6. Verify
```bash
npx prisma migrate status      # expect: Database schema is up to date!
```
Re-run the column queries from step 2: `TeamMemberInvitation` should have `invitedByUserId`
and no `invitedById`; `InspectionBooking` unchanged. Then smoke-test in the app:
create/resend a team invitation, open inspections, load the admin dashboards.

## 7. Rollback
- `migrate deploy` errors **before** any schema change → no data touched; investigate (most
  likely a pre-existing history inconsistency surfaced in step 2).
- `0040` ran and something looks off → `invitedById` was redundant (data preserved in
  `invitedByUserId`), so the drop is non-destructive; re-add from backup if ever needed.
- Anything worse → restore the step-1 snapshot.

---

## Manual fallback (only if step 2 reveals a messy/inconsistent prod history)
If `migrate deploy` can't be trusted across prod's existing history, apply the single net
schema change by hand and reconcile the records:
```sql
ALTER TABLE "TeamMemberInvitation" DROP COLUMN IF EXISTS "invitedById";
```
```bash
npx prisma migrate resolve --applied 0035a_team_member_invitation_base
npx prisma migrate resolve --applied 0040_drop_legacy_team_invitation_invited_by_id
```
(plus the 0004 checksum update from step 3). This brings `_prisma_migrations` in line so
future deploys are consistent, without running deploy across the whole suspect chain.
