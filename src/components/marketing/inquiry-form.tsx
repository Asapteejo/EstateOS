"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function InquiryForm({ propertyId }: { propertyId?: string }) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);

    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyId,
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        message: formData.get("message"),
      }),
    });

    setIsPending(false);

    if (!response.ok) {
      toast.error("Unable to submit inquiry right now.");
      return;
    }

    toast.success("Inquiry received. Our team will reach out shortly.");
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Input name="fullName" placeholder="Full name" required />
      <Input name="email" type="email" placeholder="Email address" required />
      <Input name="phone" placeholder="Phone number" />
      <Textarea
        name="message"
        placeholder="Tell us what you need, expected budget, and preferred timeline."
        required
      />
      <Button className="w-full" disabled={isPending}>
        {isPending ? "Submitting..." : "Send inquiry"}
      </Button>
    </form>
  );
}
