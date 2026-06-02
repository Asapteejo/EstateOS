import type { TenantContext } from "@/lib/tenancy/context";

type TenantStorageContext = Pick<TenantContext, "companyId" | "companySlug">;

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function getTenantStorageNamespace(context: TenantStorageContext) {
  return sanitizePathSegment(context.companySlug ?? context.companyId ?? "unknown-tenant");
}

export function namespaceTenantStorageKey(
  context: TenantStorageContext,
  domain: string,
  fileName: string,
  uniquePart: string,
) {
  const tenantNamespace = getTenantStorageNamespace(context);
  return `${tenantNamespace}/${sanitizePathSegment(domain)}/${uniquePart}-${sanitizePathSegment(fileName)}`;
}

export function isTenantStorageKey(
  context: TenantStorageContext,
  storageKey: string,
) {
  const tenantNamespace = `${getTenantStorageNamespace(context)}/`;
  return storageKey.startsWith(tenantNamespace);
}

export function assertTenantStorageKey(
  context: TenantStorageContext,
  storageKey: string | null | undefined,
) {
  if (storageKey && !isTenantStorageKey(context, storageKey)) {
    throw new Error("Storage key does not belong to the resolved tenant.");
  }
}
