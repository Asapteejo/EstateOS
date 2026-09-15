# Build spec for Claude Code — operator-created users (buyers + staff)

Run locally where you have the shell, `.env.local` with `CLERK_SECRET_KEY`, and can
run `npm run check`. This is security-sensitive (account + credential creation) — read
the whole spec, reuse the existing infra called out, and test before committing.

## Goal
Let operators create accounts that the person can log in with later:
- **Front desk** → create a **buyer** with a full profile (a walk-in / offline buyer
  who didn't purchase through the portal). They can log in with the email provided.
- **CEO (admin)** → add company staff to roles: **Marketer / Finance (accountant) /
  Front desk (STAFF) / Legal**.
- For any created account, the operator **chooses the credential delivery**:
  1. **Invite / set-password link** (primary; works with any Clerk config).
  2. **Temporary password shown once on screen** (only when Clerk password auth is
     enabled — gate behind a flag, default OFF).

## Auth reality (do not fight this)
Auth is **Clerk**; the DB has no password column. Assume **password sign-in is OFF**
until confirmed in the Clerk Dashboard, so the **invite/set-password link is the default
and the only path enabled by default.** The temp-password path is implemented but gated
behind a new flag (`featureFlags.hasClerkPassword`, from env `CLERK_PASSWORD_ENABLED`,
default false) so it can be switched on later without code changes.

## Reuse this existing infrastructure (don't reinvent)
- `src/lib/auth/clerk-user-sync.ts` — `syncAuthenticatedClerkUser` already **links a
  placeholder** `clerkUserId` that starts with `manual:` to the real Clerk account on
  first sign-in (matched by email). This is THE mechanism for operator-created users:
  create the local `User` now with `clerkUserId = "manual:" + randomUUID()`, and Clerk
  links it when they sign in. Confirm the email-match path and extend if needed.
- `src/modules/invitations/team-invitations.ts` — the invite create/accept pattern
  (`createTeamMemberInvitation` / `acceptTeamMemberInvitation`, `TeamMemberInvitation`
  table, TTL, audit). Generalize it to also cover **BUYER** and to link to a
  pre-created profile. Prefer reusing your own invitation table over Clerk invitations
  so the accept flow + local linkage you already have keeps working.
- `src/modules/admin/user-actions.ts` (`setUserRoleAction`) + `src/modules/admin/users.ts`
  (`OPERATOR_ROLES`, `ROLE_LABELS`, `CompanyUserRow`) — reuse for role assignment; the
  Marketer path already auto-provisions a `StaffProfile`.
- Buyer profile fields: the `Profile` model + `src/modules/kyc/service.ts`
  (`getBuyerProfileRecord`) — reuse for the front-desk buyer form fields.
- `src/lib/audit/service.ts` (`writeAuditLog`), `@clerk/nextjs/server` (`clerkClient`).

## Backend: `src/modules/provisioning/provision-user.ts` (new)
`provisionCompanyUser(input)`:
- Input: `{ companyId, email, fullName, phone?, role, branchId?, buyerProfile?, delivery, actor }`
  where `role ∈ {BUYER, MARKETER, FINANCE, STAFF, LEGAL}`, `delivery ∈ {"invite","password"}`.
- **Authorize the actor**: front-desk (STAFF) may create **BUYER only**; ADMIN/SUPER_ADMIN
  may create any of the roles above; never `SUPER_ADMIN`/`ADMIN` through this flow.
- **Validate**: normalize email; reject if a User with that email already exists in the
  company; company-scope everything; full name ≥ 2 chars.
- **Create local records** in a transaction:
  - `User` with `clerkUserId = "manual:" + randomUUID()`, email, firstName/lastName split
    from fullName, phone, companyId, branchId, isActive true.
  - Role via `Role`/`UserRole` upsert (reuse the pattern in `setUserRoleAction`).
  - For BUYER: create the buyer `Profile` from `buyerProfile` fields.
  - For MARKETER: `StaffProfile` (isAssignable) — mirror the existing auto-provision.
- **Delivery**:
  - `"invite"` (default/only-enabled): create a `TeamMemberInvitation`-style record
    (generalized to BUYER) and email the accept/set-password link (reuse the email
    sender + template; add a buyer variant). Return `{ mode: "invite", email }`.
  - `"password"` (only if `featureFlags.hasClerkPassword`): call
    `clerkClient().users.createUser({ emailAddress:[email], password: <generated>,
    publicMetadata:{ mustResetPassword:true, companyId } })`, set the local
    `User.clerkUserId` to the real Clerk id (replace the placeholder), and return
    `{ mode: "password", oneTimePassword: <generated> }`. If disabled, reject with a
    clear message so the UI only offers "invite".
- **Password generation**: strong (≥14 chars, upper/lower/digit/symbol) that satisfies
  Clerk's policy. **Never persist it, never put it in audit payloads or logs.**
- **Audit**: `writeAuditLog` the creation (email, role, delivery mode, actor) — NO password.

## Force change on first login (password path only)
Set `publicMetadata.mustResetPassword = true` at creation. In the portal/admin post-auth
resolution (or middleware), if the signed-in Clerk user has `mustResetPassword`, redirect
to a change-password page until it's cleared; clear the flag after they change it.

## UI
- **Front desk** — add an "Add buyer" entry on `/admin/front-desk` (or a new
  `/admin/front-desk/new-buyer`). Full buyer form (name, email, phone, address/city/state,
  occupation, notes) + a delivery choice (Invite link / Temp password — the latter only
  shown when `hasClerkPassword`). Submit → server action → **result modal**.
- **CEO** — add an "Add person" button on the Users tab (`users-management.tsx`). Modal:
  name, email, phone, role picker (Marketer / Finance / Front desk / Legal) + delivery
  choice → same result modal.
- **Credential result modal** (shared): on `mode:"password"` show the email + one-time
  password with a Copy button and a bold "This is shown once. Ask them to change it after
  first login." note; on `mode:"invite"` show "Invite sent to <email>." Both re-fetch the
  list so the new user appears.

## Security guardrails (must all hold)
- Actor-role gating (front-desk → BUYER only) enforced **server-side**, not just UI.
- Company-scoped; email unique per company.
- One-time password shown once, never stored, never logged/audited.
- Invite tokens single-use + TTL (reuse existing).
- Force-change-on-first-login for the password path.
- Rate-limit / audit every creation.

## Schema / migration
Aim for **no migration**: use the `manual:` placeholder clerkUserId + `publicMetadata`
for the reset flag + audit logs. If you must add a column (e.g. `User.createdByUserId`),
add a migration and follow `DEPLOY-PIPELINE.md` (`db:migrate:deploy` + `db:migrate:check`).

## Testing (before committing)
1. `npm run check` green.
2. Unit tests for `provisionCompanyUser`: role gating (front-desk can't create staff),
   email-uniqueness, password strength, delivery branching.
3. Manual E2E (dev): front-desk creates a buyer → invite path → accept/sign-in → buyer
   lands in `/portal` with the profile populated. CEO creates a Marketer → appears in
   Users with the role + a StaffProfile → assignable on `/admin/leads`.
4. If password auth is enabled in Clerk: create with temp password → sign in with it →
   forced to change on first login.

## Clerk config note
Temp-password path needs Clerk Dashboard → User & Authentication → **Email+Password ON**
and `CLERK_SECRET_KEY` set. Keep `CLERK_PASSWORD_ENABLED=false` until then; the invite
path needs neither and should ship first.
