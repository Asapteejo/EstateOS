import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton screen shown while the buyer portal dashboard streams in. Mirrors the
// page shape (workspace header → summary cards). No data fetching or logic here.
export default function PortalLoading() {
  return (
    <Container className="app-dark-scope py-5 lg:py-8">
      <div className="space-y-6" aria-busy="true" aria-label="Loading your workspace">
        <div className="space-y-3 border-b border-[var(--line)] pb-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-full" />
            </Card>
          ))}
        </div>
      </div>
    </Container>
  );
}
