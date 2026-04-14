import type { TenantContext } from "@/lib/tenancy/context";
import { featureFlags } from "@/lib/env";
import { logInfo } from "@/lib/ops/logger";

type TenantScopeStrategy = "companyId" | "staffProfileUserCompanyId";

type TenantScopeOptions = {
  modelName?: string;
  strategy?: TenantScopeStrategy;
};

type PublicTenantScopeOptions = TenantScopeOptions & {
  publishedOnly?: boolean;
  activeOnly?: boolean;
};

function resolveTenantScopeStrategy(modelName?: string): TenantScopeStrategy {
  if (modelName === "StaffProfile") {
    return "staffProfileUserCompanyId";
  }

  return "companyId";
}

function logTenantScope(input: {
  context: TenantContext;
  modelName?: string;
  strategy: TenantScopeStrategy;
}) {
  if (featureFlags.isProduction) {
    return;
  }

  logInfo("Building tenant-scoped query.", {
    modelName: input.modelName ?? "unknown",
    strategy: input.strategy,
    companyId: input.context.companyId,
    companySlug: input.context.companySlug,
    resolutionSource: input.context.resolutionSource,
  });
}

export function scopeTenantWhere<T extends Record<string, unknown>>(
  context: TenantContext,
  where?: T,
  options?: TenantScopeOptions,
) {
  if (context.isSuperAdmin || !context.companyId) {
    return where;
  }

  const strategy = options?.strategy ?? resolveTenantScopeStrategy(options?.modelName);
  logTenantScope({
    context,
    modelName: options?.modelName,
    strategy,
  });

  if (strategy === "companyId") {
    return {
      ...(where ?? {}),
      companyId: context.companyId,
    } as T & { companyId: string };
  }

  if (strategy === "staffProfileUserCompanyId") {
    const existingUserWhere =
      where && typeof where === "object" && "user" in where && typeof where.user === "object" && where.user
        ? (where.user as Record<string, unknown>)
        : undefined;

    return {
      ...(where ?? {}),
      user: {
        ...(existingUserWhere ?? {}),
        companyId: context.companyId,
      },
    } as unknown as T;
  }

  throw new Error(
    featureFlags.isProduction
      ? "Unsupported tenant scoping strategy."
      : `Unsupported tenant scoping strategy for model ${options?.modelName ?? "unknown"}.`,
  );
}

export function scopeTenantQueryArgs<T extends { where?: Record<string, unknown> }>(
  context: TenantContext,
  args?: T,
  options?: TenantScopeOptions,
) {
  if (context.isSuperAdmin || !context.companyId) {
    return args;
  }

  return {
    ...(args ?? {}),
    where: scopeTenantWhere(context, args?.where, options),
  } as T;
}

export function scopePublicTenantQueryArgs<T extends { where?: Record<string, unknown> }>(
  context: TenantContext,
  args?: T,
  options?: PublicTenantScopeOptions,
) {
  const scopedArgs = scopeTenantQueryArgs(context, args, options);

  if (context.isSuperAdmin || !context.companyId) {
    return scopedArgs;
  }

  const where = {
    ...(scopedArgs?.where ?? {}),
    ...(options?.publishedOnly ? { isPublished: true } : {}),
    ...(options?.activeOnly ? { isActive: true } : {}),
  };

  return {
    ...(scopedArgs ?? {}),
    where,
  } as T;
}

export async function findManyForTenant<
  TModel extends { findMany: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
  options?: TenantScopeOptions,
) {
  return model.findMany(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
      options,
    ),
  );
}

export async function findManyPublicForTenant<
  TModel extends { findMany: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
  options?: PublicTenantScopeOptions,
) {
  return model.findMany(
    scopePublicTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
      options,
    ),
  );
}

export async function findFirstForTenant<
  TModel extends { findFirst: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
  options?: TenantScopeOptions,
) {
  return model.findFirst(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
      options,
    ),
  );
}

export async function findFirstPublicForTenant<
  TModel extends { findFirst: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
  options?: PublicTenantScopeOptions,
) {
  return model.findFirst(
    scopePublicTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
      options,
    ),
  );
}

export async function countForTenant<
  TModel extends { count: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
  options?: TenantScopeOptions,
) {
  return model.count(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
      options,
    ),
  );
}

export async function aggregateForTenant<
  TModel extends { aggregate: (args?: unknown) => Promise<unknown> },
>(
  model: TModel,
  context: TenantContext,
  args?: unknown,
  options?: TenantScopeOptions,
) {
  return model.aggregate(
    scopeTenantQueryArgs(
      context,
      args as { where?: Record<string, unknown> } | undefined,
      options,
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
