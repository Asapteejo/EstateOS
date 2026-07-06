"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

const categories = [
  ["PROPERTY_GUIDANCE", "Choosing a property"],
  ["AVAILABILITY", "Confirming availability"],
  ["PAYMENT_STEPS", "Payment steps"],
  ["DOCUMENTS", "Documents or KYC"],
  ["OTHER", "Something else"],
] as const;

export function QuickInquiryForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState<(typeof categories)[number][0]>("PROPERTY_GUIDANCE");
  const [message, setMessage] = useState("");

  async function submit() {
    setPending(true);
    const response = await fetch("/api/portal/inquiries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category,
        message,
      }),
    });
    setPending(false);

    const json = (await response.json().catch(() => null)) as {
      data?: { message?: string };
      error?: string;
      issues?: Array<{ path?: string; message?: string }>;
    } | null;

    if (!response.ok) {
      const firstIssue = json?.issues?.[0];
      toast.error(firstIssue?.message ? `${firstIssue.path ? `${firstIssue.path}: ` : ""}${firstIssue.message}` : json?.error ?? "Unable to submit inquiry right now.");
      return;
    }

    setMessage("");
    toast.success(json?.data?.message ?? "Your inquiry has been sent to the sales team.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--ink-700)]">What do you need help with?</span>
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
          className="w-full"
        >
          {categories.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--ink-700)]">Message</span>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell the sales team what you want to confirm, such as property fit, availability, payment steps, or required documents."
        />
      </label>
      <Button className="w-full" onClick={submit} disabled={pending || message.trim().length < 10}>
        {pending ? "Sending..." : "Send inquiry"}
      </Button>
    </div>
  );
}
