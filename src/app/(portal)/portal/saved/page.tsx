import { DashboardShell } from "@/components/portal/dashboard-shell";
import { WishlistGrid } from "@/components/portal/wishlist-grid";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerWishlistItems } from "@/modules/wishlist/service";

export default async function PortalSavedPage() {
  const tenant = await requirePortalSession();
  const wishlist = await getBuyerWishlistItems(tenant);

  return (
    <DashboardShell area="portal" title="Wishlist" subtitle="Track saved properties, expiry windows, and follow-up progress in one place.">
      {wishlist.length > 0 ? (
        <WishlistGrid items={wishlist} />
      ) : (
        <Card className="rounded-[30px] border border-dashed border-[var(--line)] px-6 py-14 text-center text-sm text-[var(--ink-500)]">
          No wishlist activity yet. Save a property from the public site to track it here.
        </Card>
      )}
    </DashboardShell>
  );
}
