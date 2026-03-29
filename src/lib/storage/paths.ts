import type { TenantContext } from "@/lib/tenancy/context";

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function getTenantStorageNamespace(context: TenantContext) {
  return sanitizePathSegment(context.companySlug ?? context.companyId ?? "unknown-tenant");
}

export function namespaceTenantStorageKey(
  context: TenantContext,
  domain: string,
  fileName: string,
  uniquePart: string,
) {
  const tenantNamespace = getTenantStorageNamespace(context);
  return `${tenantNamespace}/${sanitizePathSegment(domain)}/${uniquePart}-${sanitizePathSegment(fileName)}`;
}

export function isTenantStorageKey(
  context: TenantContext,
  storageKey: string,
) {
  const tenantNamespace = `${getTenantStorageNamespace(context)}/`;
  return storageKey.startsWith(tenantNamespace);
}
