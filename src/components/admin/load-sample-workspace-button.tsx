"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";

export function LoadSampleWorkspaceButton({
  onLoaded,
  ...buttonProps
}: ButtonProps & { onLoaded?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function loadSampleWorkspace() {
    setPending(true);
    const response = await fetch("/api/admin/onboarding/sample-data", {
      method: "POST",
    });
    setPending(false);

    const json = (await response.json().catch(() => null)) as
      | { data?: { loaded?: boolean; reason?: string }; error?: string }
      | null;

    if (!response.ok) {
      toast.error(json?.error ?? "Unable to load sample workspace.");
      return;
    }

    if (json?.data?.loaded) {
      toast.success(json.data.reason ?? "Sample workspace loaded.");
      onLoaded?.();
      router.refresh();
      return;
    }

    toast.message(json?.data?.reason ?? "Sample workspace was not loaded.");
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={loadSampleWorkspace}
      disabled={pending}
      {...buttonProps}
    >
      {pending ? "Loading sample workspace..." : "Load sample workspace"}
    </Button>
  );
}
