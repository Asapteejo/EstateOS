import type { ReactNode } from "react";

import { PageTransition } from "@/components/shared/page-transition";

/**
 * Root template. Unlike a layout, Next.js creates a fresh instance of this on
 * every navigation, so it is the correct place to drive route-enter motion.
 * Applies a single, consistent page-transition across every surface
 * (marketing, platform, portal, admin, superadmin).
 */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
