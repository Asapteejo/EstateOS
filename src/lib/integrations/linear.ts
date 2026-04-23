import { env, featureFlags } from "@/lib/env";

export type LinearSupportIssueInput = {
  title: string;
  description: string;
  category: "bug" | "feature_request" | "question" | "billing" | "onboarding" | "other";
  priority: "HIGH" | "MEDIUM" | "LOW";
};

export type LinearIssueRecord = {
  id: string;
  identifier: string | null;
  url: string | null;
};

export type LinearIssueCreateInput = {
  title: string;
  description: string;
  labelIds?: string[];
  stateId?: string;
};

export type LinearIssueUpdateInput = {
  issueId: string;
  title?: string;
  description?: string;
  labelIds?: string[];
};

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const CATEGORY_LABEL_MAP: Record<
  LinearSupportIssueInput["category"],
  | "LINEAR_BUG_LABEL_ID"
  | "LINEAR_FEATURE_REQUEST_LABEL_ID"
  | "LINEAR_QUESTION_LABEL_ID"
  | "LINEAR_BILLING_LABEL_ID"
  | "LINEAR_ONBOARDING_LABEL_ID"
  | "LINEAR_OTHER_LABEL_ID"
> = {
  bug: "LINEAR_BUG_LABEL_ID",
  feature_request: "LINEAR_FEATURE_REQUEST_LABEL_ID",
  question: "LINEAR_QUESTION_LABEL_ID",
  billing: "LINEAR_BILLING_LABEL_ID",
  onboarding: "LINEAR_ONBOARDING_LABEL_ID",
  other: "LINEAR_OTHER_LABEL_ID",
};

export function getLinearSupportLabelIds(
  category: LinearSupportIssueInput["category"],
  priority: LinearSupportIssueInput["priority"],
): string[] {
  const labels = [env[CATEGORY_LABEL_MAP[category]]];

  if (priority === "HIGH") {
    labels.push(env.LINEAR_HIGH_PRIORITY_LABEL_ID);
  } else if (priority === "MEDIUM") {
    labels.push(env.LINEAR_MEDIUM_PRIORITY_LABEL_ID);
  } else {
    labels.push(env.LINEAR_LOW_PRIORITY_LABEL_ID);
  }

  return labels.filter((labelId): labelId is string => Boolean(labelId));
}

export function getLinearPriorityLabelId(priority: LinearSupportIssueInput["priority"]) {
  if (priority === "HIGH") {
    return env.LINEAR_HIGH_PRIORITY_LABEL_ID ?? null;
  }

  if (priority === "MEDIUM") {
    return env.LINEAR_MEDIUM_PRIORITY_LABEL_ID ?? null;
  }

  return env.LINEAR_LOW_PRIORITY_LABEL_ID ?? null;
}

export async function createLinearIssue(
  input: LinearIssueCreateInput,
): Promise<LinearIssueRecord | null> {
  if (!featureFlags.hasLinear) {
    return null;
  }

  const query = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: env.LINEAR_API_KEY!,
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          teamId: env.LINEAR_TEAM_ID,
          title: input.title,
          description: input.description,
          labelIds: input.labelIds,
          stateId: input.stateId,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear issue creation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: {
      issueCreate?: {
        success?: boolean;
        issue?: LinearIssueRecord | null;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message ?? "Unknown Linear error.").join(" | "));
  }

  const issue = payload.data?.issueCreate?.issue;
  if (!payload.data?.issueCreate?.success || !issue) {
    throw new Error("Linear issue creation did not return an issue.");
  }

  return issue;
}

export async function updateLinearIssue(
  input: LinearIssueUpdateInput,
): Promise<LinearIssueRecord | null> {
  if (!featureFlags.hasLinear) {
    return null;
  }

  const query = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: env.LINEAR_API_KEY!,
    },
    body: JSON.stringify({
      query,
      variables: {
        id: input.issueId,
        input: {
          title: input.title,
          description: input.description,
          labelIds: input.labelIds,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear issue update failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: {
      issueUpdate?: {
        success?: boolean;
        issue?: LinearIssueRecord | null;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message ?? "Unknown Linear error.").join(" | "));
  }

  const issue = payload.data?.issueUpdate?.issue;
  if (!payload.data?.issueUpdate?.success || !issue) {
    throw new Error("Linear issue update did not return an issue.");
  }

  return issue;
}

export async function createLinearSupportIssue(
  input: LinearSupportIssueInput,
): Promise<LinearIssueRecord | null> {
  return createLinearIssue({
    title: input.title,
    description: input.description,
    labelIds: getLinearSupportLabelIds(input.category, input.priority),
    stateId: env.LINEAR_SUPPORT_STATE_ID ?? undefined,
  });
}
