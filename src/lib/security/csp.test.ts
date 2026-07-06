import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildContentSecurityPolicy,
  generateCspNonce,
  resolveMediaHost,
  THEME_INIT_SCRIPT,
  THEME_INIT_SCRIPT_HASH,
} from "@/lib/security/csp";

test("theme init script hash matches the script text (no silent drift)", () => {
  const digest = createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64");
  assert.equal(THEME_INIT_SCRIPT_HASH, `sha256-${digest}`);
});

test("policy carries the nonce, strict-dynamic, and the theme script hash", () => {
  const policy = buildContentSecurityPolicy({ nonce: "abc123" });
  assert.match(policy, /script-src [^;]*'nonce-abc123'/);
  assert.match(policy, /script-src [^;]*'strict-dynamic'/);
  assert.ok(policy.includes(`'${THEME_INIT_SCRIPT_HASH}'`));
  // script-src-elem must stay aligned with script-src.
  assert.match(policy, /script-src-elem [^;]*'nonce-abc123'/);
});

test("production policy never includes unsafe-eval", () => {
  const policy = buildContentSecurityPolicy({ nonce: "abc123" });
  assert.ok(!policy.includes("'unsafe-eval'"));
});

test("unsafe-eval is opt-in for non-production runtimes only", () => {
  const policy = buildContentSecurityPolicy({ nonce: "abc123", allowUnsafeEval: true });
  assert.ok(policy.includes("'unsafe-eval'"));
});

test("core directives fail closed", () => {
  const policy = buildContentSecurityPolicy({ nonce: "n" });
  assert.ok(policy.includes("default-src 'self'"));
  assert.ok(policy.includes("object-src 'none'"));
  assert.ok(policy.includes("base-uri 'self'"));
  assert.ok(policy.includes("frame-ancestors 'self'"));
});

test("tenant media host lands in img-src and media-src when configured", () => {
  const policy = buildContentSecurityPolicy({ nonce: "n", mediaHost: "media.estateos.tech" });
  assert.match(policy, /img-src [^;]*https:\/\/media\.estateos\.tech/);
  assert.match(policy, /media-src [^;]*https:\/\/media\.estateos\.tech/);
  // Without a host, no dangling entries appear.
  const bare = buildContentSecurityPolicy({ nonce: "n" });
  assert.ok(!bare.includes("media.estateos.tech"));
  assert.match(bare, /img-src [^;]*https:\/\/\*\.r2\.dev/);
});

test("resolveMediaHost parses base URLs and fails closed", () => {
  assert.equal(resolveMediaHost("https://media.estateos.tech/assets"), "media.estateos.tech");
  assert.equal(resolveMediaHost("not a url"), null);
  assert.equal(resolveMediaHost(undefined), null);
  assert.equal(resolveMediaHost(""), null);
});

test("nonces are unique and base64", () => {
  const first = generateCspNonce();
  const second = generateCspNonce();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9+/]+=*$/);
});
