import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDomainAssignable,
  buildCustomDomainDnsInstructions,
  normalizeCustomDomain,
} from "@/lib/domains/custom-domain";

test("custom domain normalization rejects unsafe hostnames and URLs", () => {
  for (const input of [
    "localhost",
    "admin.localhost",
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.10",
    "172.16.0.5",
    "https://example.com",
    "example.com/path",
    "example.com?x=1",
    "example.com#section",
  ]) {
    assert.throws(() => normalizeCustomDomain(input), /domain|localhost|IP|protocol|path|query|fragment/i);
  }
});

test("custom domain normalization accepts public hostnames", () => {
  assert.equal(normalizeCustomDomain(" WWW.Example.COM "), "www.example.com");
  assert.equal(normalizeCustomDomain("sales.example.co.uk"), "sales.example.co.uk");
});

test("custom domain assignment rejects cross-company collisions", () => {
  assert.throws(
    () => assertDomainAssignable({
      requestedDomain: "sales.example.com",
      targetCompanyId: "company-a",
      conflictCompanyId: "company-b",
    }),
    /already in use/i,
  );
});

test("custom domain assignment allows existing domain on same company", () => {
  assert.doesNotThrow(() => assertDomainAssignable({
      requestedDomain: "sales.example.com",
      targetCompanyId: "company-a",
      conflictCompanyId: "company-a",
    }));
});

test("custom domain DNS instructions use configured env targets", () => {
  assert.deepEqual(
    buildCustomDomainDnsInstructions({
      cnameTarget: "estateos.tech",
      rootTarget: "ALIAS estateos.tech",
    }),
    {
      cname: {
        type: "CNAME",
        host: "www",
        target: "estateos.tech",
      },
      root: {
        type: "A/ALIAS/ANAME",
        host: "@",
        target: "ALIAS estateos.tech",
      },
      note: "Go to your domain provider, create the DNS record, wait for propagation, then click Verify.",
    },
  );
});
