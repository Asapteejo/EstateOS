# Prompt for Claude Code — commit & push all updates

Copy everything in the fenced block below and paste it into Claude Code, run from the
repository root (`C:\Users\HP\Desktop\Realestate saas`).

```
Commit and push all current work in this repository. Follow these steps carefully and stop if any gate fails.

CONTEXT
- Branch should be `feat/design-system-v2`, tracking `origin/feat/design-system-v2`.
- There is a large amount of uncommitted work (~120 modified files, ~70 new files), including:
  - Prisma migrations 0042–0047 (site-content CMS, team staff-code unique, front-desk visitor/call log, property invoices, in-app messaging, announcements).
  - New features: in-app messaging, announcements/broadcast banner, property invoices, front-desk logbook + dashboard, CEO executive overview, finance board, reservations board, site-content CMS.
  - Design-system v2: tokens, dark mode, page transitions, command palette, loading/empty primitives, scroll-aware header, marketing/tenant redesigns.
  - WhatsApp click-to-chat: a shared `WhatsAppButton` wired into clients, front-desk visitor log, leads/inquiries, inspections, schedule, team, transactions, and payment requests. Two of these (transactions, payment requests) also plumb a `buyerPhone` field through the queries in `src/modules/admin/operations.ts` and `src/modules/admin/control-center.ts`.

STEPS
1. Run `git status` and `git rev-parse --abbrev-ref HEAD`. Confirm the branch is `feat/design-system-v2`. If it is not, stop and tell me before doing anything else.
2. Make sure no stray build artifacts are staged or present: `tc.out`, `tc_result.log`, `tsconfig.scope.json`, or any files matching `_wa_*`, `_cav*`, `_orig*`, `*_test.tsx` scratch files. If any exist, delete them. (`RECAP.md` is intentional — keep it.)
3. Run the full verification gate: `npm run check`. This runs test + typecheck + lint + build. Do NOT commit if it fails — instead, show me the failing output and stop.
4. If the check passes, stage everything: `git add -A`.
5. Show me `git status` and `git diff --cached --stat` so I can see exactly what will be committed. 
6. Commit with this message (a single commit is fine):

   feat: WhatsApp click-to-chat across operator surfaces + session feature set

   - Add shared WhatsAppButton (wa.me click-to-chat, no wallet/credentials) and wire it into
     clients, front-desk visitor log, leads/inquiries, inspections, schedule, team,
     transactions, and payment requests. Plumb buyerPhone through transactions and
     payment-request queries (company-guarded).
   - In-app messaging, announcements/broadcast banner, property invoices, front-desk
     logbook + dashboard, CEO executive overview, finance board, reservations board,
     site-content CMS (migrations 0042–0047).
   - Design-system v2: tokens, dark mode, page transitions, command palette, loading/empty
     primitives, scroll-aware header, marketing + tenant redesigns.

7. Push: `git push origin feat/design-system-v2`. If the branch has no upstream yet, use `git push -u origin feat/design-system-v2`.
8. Report the final commit hash and confirm the push succeeded.

Do not open a pull request unless I ask. Do not rebase or force-push.
```

## Notes
- The database-touching tests only pass on your Windows machine (Prisma Client is generated
  for Windows). That's why `npm run check` is the right gate to run there.
- Migrations 0046 and 0047 were already applied per the session recap; committing them just
  records the migration files in git.
