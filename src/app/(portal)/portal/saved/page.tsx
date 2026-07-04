import { DashboardShell } from "@/components/portal/dashboard-shell";
import { WishlistGrid } from "@/components/portal/wishlist-grid";
import { EmptyState } from "@/components/ui/empty-state";
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
        <EmptyState
          icon={<HeartIcon />}
          title="No saved properties yet"
          description="Save a property from the public site to track its price, payment plan, and expiry window here."
        />
      )}
    </DashboardShell>
  );
}

function HeartIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
