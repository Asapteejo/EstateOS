"use client";

import { SuperadminRouteError } from "@/components/superadmin/superadmin-route-error";

export default function SuperadminActivityError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SuperadminRouteError {...props} route="/superadmin/activity" />;
}

