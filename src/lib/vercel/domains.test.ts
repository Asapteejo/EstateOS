import assert from "node:assert/strict";
import test from "node:test";

import {
  addVercelProjectDomainsForTenant,
  checkVercelProjectDomainsForTenant,
  getVercelDomainAliases,
} from "@/lib/vercel/domains";

const config = {
  apiToken: "token",
  projectId: "project_123",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("vercel domain aliases include www for apex domains", () => {
  assert.deepEqual(getVercelDomainAliases("example.com"), {
    apexDomain: "example.com",
    wwwDomain: "www.example.com",
    domains: ["example.com", "www.example.com"],
  });
});

test("vercel domain attach adds apex and www alias", async () => {
  const calls: Array<{ method: string; url: string; body?: string | null }> = [];
  const attached = new Set<string>();
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    calls.push({
      method: init?.method ?? "GET",
      url,
      body: init?.body?.toString() ?? null,
    });

    if (url.includes("/config")) {
      return jsonResponse({ configuredBy: "A", misconfigured: false }, 200);
    }

    if (init?.method === "GET" && url.includes("/domains/")) {
      const domain = decodeURIComponent(url.split("/domains/")[1]?.split("?")[0] ?? "");
      return attached.has(domain)
        ? jsonResponse({ name: domain, verified: false }, 200)
        : jsonResponse({ error: { message: "Not found" } }, 404);
    }

    if (init?.method === "POST") {
      const name = JSON.parse(init.body?.toString() ?? "{}").name;
      attached.add(name);
      return jsonResponse({ name, verified: false }, 200);
    }

    return jsonResponse({ configuredBy: "CNAME", misconfigured: false }, 200);
  };

  const result = await addVercelProjectDomainsForTenant("example.com", config, fetcher as typeof fetch);

  assert.equal(result.configured, true);
  assert.equal(result.attached, true);
  assert.equal(calls.filter((call) => call.method === "POST").length, 2);
  assert.match(calls.find((call) => call.body?.includes("example.com"))?.url ?? "", /\/v10\/projects\/project_123\/domains/);
  assert.ok(calls.some((call) => call.body?.includes("www.example.com")));
});

test("vercel domain attach is idempotent when domains already exist", async () => {
  const calls: string[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init?.method ?? "GET");
    if (input.toString().includes("/config")) {
      return jsonResponse({ configuredBy: "A", misconfigured: false }, 200);
    }

    return jsonResponse({ name: "example.com", verified: true }, 200);
  };

  const result = await addVercelProjectDomainsForTenant("example.com", config, fetcher as typeof fetch);

  assert.equal(result.attached, true);
  assert.equal(calls.includes("POST"), false);
});

test("missing vercel config returns manual setup fallback", async () => {
  const result = await checkVercelProjectDomainsForTenant("example.com", {});

  assert.equal(result.configured, false);
  assert.equal(result.manualSetupRequired, true);
  assert.equal(result.attached, false);
  assert.match(result.error ?? "", /not configured/i);
});
