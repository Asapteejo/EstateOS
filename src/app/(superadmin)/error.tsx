"use client";

import { AuthenticatedSurfaceError } from "@/components/shared/authenticated-surface-error";

export default function SuperadminSurfaceError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AuthenticatedSurfaceError {...props} surface="superadmin" />;
}

