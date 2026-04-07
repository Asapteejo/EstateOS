"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DevCreateCompanyButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);

    try {
      const response = await fetch("/api/dev/create-company", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { redirectTo?: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to create a development company.");
      }

      toast.success("Test company created.");
      router.push(payload.data?.redirectTo ?? "/admin");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create a development company.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? "Creating test company..." : "Create Test Company"}
    </Button>
  );
}
