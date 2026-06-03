import assert from "node:assert/strict";
import test from "node:test";

import { verifyTenantDomainDns, type DnsResolver } from "@/lib/domains/verify";

test("tenant domain DNS verification passes for apex A and www CNAME", async () => {
  const resolver: DnsResolver = {
    async resolve4(domain) {
      assert.equal(domain, "example.com");
      return ["76.76.21.21"];
    },
    async resolveCname(domain) {
      assert.equal(domain, "www.example.com");
      return ["cname.vercel-dns.com"];
    },
  };

  const result = await verifyTenantDomainDns("example.com", { resolver });

  assert.equal(result.verified, true);
  assert.equal(result.apex.verified, true);
  assert.equal(result.www?.verified, true);
});

test("tenant domain DNS verification fails when apex A record is wrong", async () => {
  const resolver: DnsResolver = {
    async resolve4() {
      return ["192.0.2.10"];
    },
    async resolveCname() {
      return ["cname.vercel-dns.com"];
    },
  };

  const result = await verifyTenantDomainDns("example.com", { resolver });

  assert.equal(result.verified, false);
  assert.match(result.reason ?? "", /A record/i);
});
