import type { TenantContext } from "@/lib/tenancy/context";

export function scopeTenantWhere<T extends Record<string, unknown>>(
  context: TenantContext,
  where?: T,
) {
  if (context.isSuperAdmin || !context.companyId) {
    return where;
  }

  return {
    ...(where ?? {}),
    companyId: context.companyId,
  } as T & { companyId: string };
}

export function scopeTenantQueryArgs<T extends { where?: Record<string, unknown> }>(
  context: TenantContext,
  args?: T,
) {
  if (context.isSuperAdmin || !context.companyId) {
    return args;
  }

  return {
    ...(args ?? {}),
    where: scopeTenantWhere(context, args?.where),
  } as T;
}

export async function findManyForTenant<
  TModel extends { findMany: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
) {
  return model.findMany(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
    ),
  );
}

export async function findFirstForTenant<
  TModel extends { findFirst: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
) {
  return model.findFirst(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
    ),
  );
}

export async function countForTenant<
  TModel extends { count: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
) {
  return model.count(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
    ),
  );
}

export async function aggregateForTenant<
  TModel extends { aggregate: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
) {
  return model.aggregate(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
    ),
  );
}

export function companyScopedCreateData<T extends Record<string, unknown>>(
  context: TenantContext,
  data: T,
) {
  if (context.isSuperAdmin || !context.companyId) {
    return data;
  }

  return {
    ...data,
    companyId: context.companyId,
  };
}

export function rejectUnsafeCompanyIdInput(input: Record<string, unknown>) {
  if ("companyId" in input) {
    throw new Error("Caller-provided companyId is not allowed.");
  }

  return true;
}
