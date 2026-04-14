"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DevCreateBuyerProfileButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);

    const response = await fetch("/api/dev/buyer-profile", {
      method: "POST",
    });

    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to create a test buyer profile.");
      return;
    }

    toast.success("Test buyer profile created.");
    router.refresh();
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="outline">
      {pending ? "Creating..." : "Create test buyer profile"}
    </Button>
  );
}
