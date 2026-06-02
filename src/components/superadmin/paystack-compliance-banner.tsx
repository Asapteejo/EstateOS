import { Container } from "@/components/shared/container";
import { featureFlags } from "@/lib/env";

export function getPaystackComplianceBanner(paystackConfigured: boolean) {
  return paystackConfigured
    ? null
    : "Paystack compliance pending. Live payments disabled.";
}

export function PaystackComplianceBanner() {
  const message = getPaystackComplianceBanner(featureFlags.hasPaystack);
  if (!message) return null;

  return (
    <Container className="pt-5">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        {message}
      </div>
    </Container>
  );
}
