#!/usr/bin/env node
/**
 * Generates src/lib/ops/migration-manifest.ts from the folders in
 * prisma/migrations.
 *
 * WHY THIS EXISTS
 * ---------------
 * The readiness endpoint (/api/readyz) compares the migrations applied in the
 * live database against a list of expected migrations. That list used to be
 * hand-maintained and silently went stale: it stopped at 0035 while the repo
 * grew to 0049, so readyz reported `migrations: ok` while production was
 * missing 14 migrations — including 0042, whose absent columns produced a
 * P2022 "column does not exist" 500 in production.
 *
 * A generated manifest cannot go stale. `--check` fails CI when someone adds
 * a migration without regenerating, so the drift detector always knows about
 * every migration in the repo.
 *
 * Usage:
 *   node scripts/generate-migration-manifest.mjs           # write the file
 *   node scripts/generate-migration-manifest.mjs --check   # verify, exit 1 if stale
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");
const OUTPUT_FILE = path.join(ROOT, "src", "lib", "ops", "migration-manifest.ts");

function readMigrationNames() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    // A directory is a real migration only when it holds a migration.sql.
    .filter((entry) =>
      fs.existsSync(path.join(MIGRATIONS_DIR, entry.name, "migration.sql")),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function renderManifest(names) {
  const entries = names.map((name) => `  ${JSON.stringify(name)},`).join("\n");

  return `// GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with: node scripts/generate-migration-manifest.mjs
//
// Every migration directory in prisma/migrations, used by the readiness
// endpoint to detect a database that is behind the deployed code. Generated
// so the list can never silently go stale (see the script header for the
// production incident that motivated this).

export const EXPECTED_PRODUCTION_MIGRATIONS = [
${entries}
] as const;
`;
}

const names = readMigrationNames();
const contents = renderManifest(names);
const isCheck = process.argv.includes("--check");

if (isCheck) {
  const existing = fs.existsSync(OUTPUT_FILE)
    ? fs.readFileSync(OUTPUT_FILE, "utf8")
    : "";

  // Normalize line endings so the check passes on both Windows and Linux/CI.
  if (existing.replace(/\r\n/g, "\n") !== contents.replace(/\r\n/g, "\n")) {
    console.error(
      "Migration manifest is out of date.\n" +
        "Run: node scripts/generate-migration-manifest.mjs\n" +
        `Expected ${names.length} migration(s) from prisma/migrations.`,
    );
    process.exit(1);
  }

  console.log(`Migration manifest is up to date (${names.length} migrations).`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, contents);
console.log(`Wrote ${OUTPUT_FILE} (${names.length} migrations).`);
