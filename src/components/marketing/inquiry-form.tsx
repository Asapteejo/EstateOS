"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SuccessCheck } from "@/components/ui/success-check";
import { Textarea } from "@/components/ui/textarea";

export function InquiryForm({ propertyId }: { propertyId?: string }) {
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

    const json = (await response.json().catch(() => null)) as {
      error?: string;
      issues?: Array<{ path?: string; message?: string }>;
    } | null;

    if (!response.ok) {
      const firstIssue = json?.issues?.[0];
      toast.error(firstIssue?.message ? `${firstIssue.path ? `${firstIssue.path}: ` : ""}${firstIssue.message}` : json?.error ?? "Unable to submit inquiry right now.");
      return;
    }

    toast.success("Inquiry received. Our team will reach out shortly.");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white px-6 py-12 text-center">
        <SuccessCheck label="Inquiry sent" />
        <div>
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">Inquiry received</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--ink-500)]">
            Thanks — our team will reach out shortly. Need to add something? Send another below.
          </p>
        </div>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Send another inquiry
        </Button>
      </div>
    );
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

      <Field label="Phone number">
        <Input
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+234 800 000 0000"
        />
      </Field>

      <Field label="How can we help?" required>
        <Textarea
          name="message"
          placeholder="Tell us what you need, expected budget, and preferred timeline."
          required
        />
      </Field>

      <Button className="w-full" loading={isPending}>
        {isPending ? "Submitting…" : "Send inquiry"}
      </Button>
    </form>
  );
}
