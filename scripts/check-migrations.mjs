// Fails (exit 1) if the target database has migrations that have not been applied,
// or has drifted from the Prisma schema. Run this against a database BEFORE serving
// application code that depends on the latest schema — it is the guard that would
// have caught the production "column does not exist" error.
//
// Usage (reads DATABASE_URL/DIRECT_URL from the environment):
//   node scripts/check-migrations.mjs
//   DATABASE_URL="<prod url>" node scripts/check-migrations.mjs   # check production
import { spawnSync } from "node:child_process";
import path from "node:path";

const prismaBin = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const res = spawnSync(process.execPath, [prismaBin, "migrate", "status"], {
  env: process.env,
  encoding: "utf8",
  shell: false,
});

const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
process.stdout.write(output);

const pending =
  res.status !== 0 ||
  /have not yet been applied|not yet been applied|drift|schema is not in sync/i.test(output);

if (pending) {
  console.error(
    "\n✗ Database is NOT up to date with prisma/migrations.\n" +
    "  Run `npm run db:migrate:deploy` against this database before deploying app code.\n",
  );
  process.exit(1);
}

console.log("\n✓ Database schema is up to date with all migrations.\n");
