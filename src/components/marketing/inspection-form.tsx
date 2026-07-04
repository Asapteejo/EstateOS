"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
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
      <Field label="Full name" required>
        <Input name="fullName" autoComplete="name" placeholder="Jane Doe" required />
      </Field>

      <Field label="Email address" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="jane@example.com"
          required
        />
      </Field>

      <Field label="Phone number" required>
        <Input
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+234 800 000 0000"
          required
        />
      </Field>

      <Field label="Preferred date & time" required hint="Pick a date and time that works for you.">
        <Input name="scheduledFor" type="datetime-local" required />
      </Field>

      <Button variant="outline" className="w-full" disabled={isPending}>
        {isPending ? "Booking..." : "Book inspection"}
      </Button>
    </form>
  );
}
