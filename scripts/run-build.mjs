import { spawnSync } from "node:child_process";

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

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
