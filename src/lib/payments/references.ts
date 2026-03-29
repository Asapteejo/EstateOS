import type { TenantContext } from "@/lib/tenancy/context";

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

export function namespacePaymentReference(
  context: TenantContext,
  reference: string,
) {
  const tenantSegment = sanitizeSegment(context.companySlug ?? context.companyId ?? "tenant");

  if (reference.startsWith(`${tenantSegment}__`)) {
    return reference;
  }

  return `${tenantSegment}__${sanitizeSegment(reference)}`;
}

export function parseTenantPaymentReference(reference: string) {
  const [tenantSegment, ...rest] = reference.split("__");
  if (!tenantSegment || rest.length === 0) {
    return null;
  }

  return {
    tenantSegment,
    rawReference: rest.join("__"),
  };
}

export function assertPaymentReferenceBelongsToTenant(
  context: TenantContext,
  reference: string,
) {
  if (context.isSuperAdmin) {
    return true;
  }

  const parsed = parseTenantPaymentReference(reference);
  const currentSegment = sanitizeSegment(context.companySlug ?? context.companyId ?? "");

  if (!parsed || parsed.tenantSegment !== currentSegment) {
    throw new Error("Cross-tenant payment reference denied.");
  }

  return true;
}
