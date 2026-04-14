#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const roots = ["src", "prisma"];
const allowedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
  ".yml",
  ".yaml",
]);

const suspiciousTextPatterns = [
  { label: "mojibake bullet", pattern: "â€¢" },
  { label: "middot bullet", pattern: "·" },
  { label: "left smart quote", pattern: "“" },
  { label: "right smart quote", pattern: "”" },
  { label: "left smart apostrophe", pattern: "‘" },
  { label: "right smart apostrophe", pattern: "’" },
  { label: "en dash", pattern: "–" },
  { label: "em dash", pattern: "—" },
  { label: "ellipsis", pattern: "…" },
];

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) {
    return output;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, output);
      continue;
    }

    if (allowedExtensions.has(path.extname(entry.name))) {
      output.push(fullPath);
    }
  }

  return output;
}

const failures = [];

for (const root of roots) {
  for (const filePath of walk(root)) {
    const bytes = fs.readFileSync(filePath);
    let text = "";

    try {
      text = utf8Decoder.decode(bytes);
    } catch {
      failures.push({
        file: filePath,
        reason: "invalid UTF-8 byte sequence",
      });
      continue;
    }

    for (const entry of suspiciousTextPatterns) {
      if (text.includes(entry.pattern)) {
        failures.push({
          file: filePath,
          reason: `contains ${entry.label}`,
        });
      }
    }
  }
}

if (failures.length > 0) {
  console.error("UTF-8 audit failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.reason}`);
  }
  process.exit(1);
}

console.log("UTF-8 audit passed.");
