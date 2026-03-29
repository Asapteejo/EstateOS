"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InspectionForm({ propertyId }: { propertyId: string }) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);

    const response = await fetch("/api/inspections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyId,
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        scheduledFor: formData.get("scheduledFor"),
      }),
    });

    setIsPending(false);

    if (!response.ok) {
      toast.error("Unable to book inspection right now.");
      return;
    }

    toast.success("Inspection booking submitted.");
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Input name="fullName" placeholder="Full name" required />
      <Input name="email" type="email" placeholder="Email address" required />
      <Input name="phone" placeholder="Phone number" required />
      <Input name="scheduledFor" type="datetime-local" required />
      <Button variant="outline" className="w-full" disabled={isPending}>
        {isPending ? "Booking..." : "Book inspection"}
      </Button>
    </form>
  );
}
