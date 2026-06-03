import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDomainAssignable,
  buildCustomDomainDnsInstructions,
  getCustomDomainLookupCandidates,
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
        type: "A",
        host: "@",
        target: "ALIAS estateos.tech",
      },
      note: "Go to your domain provider, create the DNS record, wait for propagation, then click Verify.",
    },
  );
});

test("custom domain lookup candidates include apex fallback for www host", () => {
  assert.deepEqual(getCustomDomainLookupCandidates("www.example.com"), [
    "www.example.com",
    "example.com",
  ]);
  assert.deepEqual(getCustomDomainLookupCandidates("example.com:443"), ["example.com"]);
});
