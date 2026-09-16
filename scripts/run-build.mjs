import { spawnSync } from "node:child_process";
import path from "node:path";

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=4096"]
    .filter(Boolean)
    .join(" "),
};

// Builds must not require direct database access. Run `npm run db:migrate:deploy`
// separately in a controlled CI/release step before deploying application code.
//
// The migration manifest is regenerated first so the readiness endpoint always
// ships knowing about every migration in the repo. Without this the expected
// list drifts and /api/readyz reports a false green while the database is
// behind the code.
const steps = [
  ["migrationManifest", []],
  ["prisma", ["generate"]],
  ["next", ["build"]],
];

const cliEntrypoints = {
  migrationManifest: path.join(process.cwd(), "scripts", "generate-migration-manifest.mjs"),
  prisma: path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
  next: path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
};

for (const [command, args] of steps) {
  const entrypoint = cliEntrypoints[command];

  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
