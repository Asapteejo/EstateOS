import { spawnSync } from "node:child_process";
import path from "node:path";

const mode = process.argv[2] === "vercel" ? "vercel" : "build";

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=4096"]
    .filter(Boolean)
    .join(" "),
};

const steps =
  mode === "vercel"
    ? [
        ["prisma", ["generate"]],
        ["prisma", ["migrate", "deploy"]],
        ["next", ["build"]],
      ]
    : [
        ["prisma", ["generate"]],
        ["next", ["build"]],
      ];

const cliEntrypoints = {
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
