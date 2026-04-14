"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BuyerWishlistItem } from "@/modules/wishlist/service";

export function WishlistGrid({ items }: { items: BuyerWishlistItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function removeWishlist(propertyId: string) {
    setPendingId(propertyId);
    const response = await fetch("/api/saved-properties", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ propertyId }),
    });
    setPendingId(null);

    if (!response.ok) {
      toast.error("Unable to update wishlist.");
      return;
    }

    toast.success("Wishlist updated.");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id} className="overflow-hidden rounded-[30px] border-[var(--line)] bg-white">
          <div className="relative h-64 bg-[linear-gradient(140deg,#f7f1e7,#edf5f0)]">
            <Image src={item.propertyImage} alt={item.propertyTitle} fill className="object-cover" />
          </div>
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{item.status}</Badge>
              <Badge>{item.followUpStatus}</Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-[var(--ink-950)]">{item.propertyTitle}</h2>
              <div className="mt-2 text-sm text-[var(--ink-500)]">
                Saved {item.savedAt}  -  {item.timeLabel}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-[var(--sand-100)] p-4">
                <div className="text-sm text-[var(--ink-500)]">Price</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{item.propertyPrice}</div>
              </div>
              <div className="rounded-3xl bg-[var(--sand-100)] p-4">
                <div className="text-sm text-[var(--ink-500)]">Plan summary</div>
                <div className="mt-2 text-sm font-medium text-[var(--ink-950)]">{item.paymentPlanSummary}</div>
              </div>
            </div>
            {item.selectedMarketerName ? (
              <div className="text-sm text-[var(--ink-600)]">
                Selected marketer: <strong>{item.selectedMarketerName}</strong>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link href={`/properties/${item.propertySlug}`}>
                <Button>Open property</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => removeWishlist(item.propertyId)}
                disabled={pendingId === item.propertyId}
              >
                {pendingId === item.propertyId ? "Updating..." : "Remove"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
