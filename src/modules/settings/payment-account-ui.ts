export type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error?: string;
    };

export function unwrapApiData<T>(json: ApiEnvelope<T> | T): T {
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    return json.data as T;
  }

  if (json && typeof json === "object" && "success" in json && json.success === false) {
    throw new Error(json.error ?? "Request failed.");
  }

  return json as T;
}

export function getPaymentSetupState(input: {
  hasAccount: boolean;
  paystackConfigured: boolean;
}) {
  if (!input.paystackConfigured) {
    return {
      tone: "danger" as const,
      title: "Payment setup requires Paystack configuration",
      canSubmit: false,
    };
  }

  if (!input.hasAccount) {
    return {
      tone: "warning" as const,
      title: "Set up payment account",
      canSubmit: true,
    };
  }

  return {
    tone: "success" as const,
    title: "Payment account connected",
    canSubmit: true,
  };
}
