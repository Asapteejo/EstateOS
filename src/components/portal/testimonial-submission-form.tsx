"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { TestimonialPropertyOption } from "@/modules/testimonials/service";
import { Select } from "@/components/ui/select";

type Props = {
  properties: TestimonialPropertyOption[];
  endpoint?: string;
  method?: "POST" | "PATCH";
  initial?: {
    title?: string | null;
    quote?: string;
    rating?: number;
  };
  submitLabel?: string;
};

type ValidationIssue = {
  message?: string;
};

export function TestimonialSubmissionForm({
  properties,
  endpoint = "/api/portal/testimonials",
  method = "POST",
  initial,
  submitLabel = "Send for review",
}: Props) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: form.get("propertyId")?.toString() || undefined,
        title: form.get("title")?.toString() || undefined,
        quote: form.get("quote")?.toString() || "",
        rating,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      issues?: ValidationIssue[];
      data?: { message?: string };
    } | null;

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(payload?.issues?.[0]?.message ?? payload?.error ?? "Unable to submit testimonial.");
      return;
    }

    toast.success(payload?.data?.message ?? "Sent for review.");
    router.refresh();
    if (method === "POST") {
      event.currentTarget.reset();
      setRating(5);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-[var(--ink-900)]" htmlFor="testimonial-property">
          Related property
        </label>
        <Select
          id="testimonial-property"
          name="propertyId" className="mt-2 w-full"
        >
          <option value="">Company testimonial</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--ink-900)]">Rating</label>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`admin-focus text-2xl ${value <= rating ? "text-amber-500" : "text-[var(--ink-300)]"}`}
              aria-label={`${value} star rating`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--ink-900)]" htmlFor="testimonial-title">
          Title
        </label>
        <input
          id="testimonial-title"
          name="title"
          defaultValue={initial?.title ?? ""}
          placeholder="Optional short headline"
          className="admin-focus mt-2 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--ink-900)]" htmlFor="testimonial-quote">
          Testimonial
        </label>
        <textarea
          id="testimonial-quote"
          name="quote"
          defaultValue={initial?.quote ?? ""}
          placeholder="Share what made your buying experience clear, trustworthy, or helpful."
          className="admin-focus mt-2 min-h-36 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-3 text-sm leading-6"
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : submitLabel}
      </Button>
    </form>
  );
}
